import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Group, MeshStandardMaterial, type TubeGeometry } from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { resolveEndpoint, type Vec3 } from './anchors';
import { plugQuaternion } from './Rj45Plug';
import {
  connectorCableOffsetMm,
  connectorInsertionMm,
  connectorKindFor,
  connectorSpec,
  type ConnectorKind,
} from './engine/connectors';
import { acquireTube, releaseTube } from './engine/geometryCache';
import { applyBundleOffset, bundleSlot } from './engine/bundles';
import { maxTurnAngleDeg } from './engine/spline';
import { CABLE_CATALOG } from './cableCatalog';
import { checkCable } from './compatibility';
import {
  computeRoute,
  estimateRouteCollisions,
  recommendLengthMm,
} from './routing';
import { getDevice } from '@/features/devices/deviceRegistry';
import { focusCable } from '@/features/viewport/focusActions';
import { railHeight, U_METERS } from '@/features/rack/rackConstants';
import { MM_TO_M, type PlacedDevice, type RackGeometry } from '@/features/rack/rackMath';
import {
  bundleMembers,
  consumeBornAnimation,
  useCableStore,
  type CableInstance,
} from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { shouldSuppressClick } from '@/stores/dragStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
import type { RackConfig } from '@/types';

/**
 * Cable rendering — the Cable Engine's output stage, inside the rack
 * group (so rack orientation and animation are inherited). Routes come
 * from the deterministic routing engine, centerlines from the
 * arc-fillet spline stage (every bend honors the profile's minimum
 * radius scaled by stiffness), tube geometry from the ref-counted
 * cache, and connectors from the metadata-driven factory. Newly
 * created cables draw themselves in with a short connector-insertion
 * animation.
 */

/* Shared sheath materials, keyed by color|roughness|metalness. */
const sheathMaterials = new Map<string, MeshStandardMaterial>();
function sheathMaterial(
  color: string,
  roughness: number,
  metalness: number,
): MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`;
  let material = sheathMaterials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness, metalness });
    sheathMaterials.set(key, material);
  }
  return material;
}

const SELECTION_MATERIAL = new MeshStandardMaterial({
  color: '#4c82f7',
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

interface CableLayerProps {
  rack: RackConfig;
  geometry: RackGeometry;
}

export function CableLayer({ rack, geometry }: CableLayerProps) {
  const cables = useCableStore((s) => s.cables);
  const instances = useDeviceInstancesStore((s) => s.instances);
  if (cables.length === 0) return null;
  return (
    <group>
      {cables.map((cable) => (
        <CableMesh
          key={cable.id}
          cable={cable}
          rack={rack}
          geometry={geometry}
          instances={instances}
        />
      ))}
    </group>
  );
}

function CableMesh({
  cable,
  rack,
  geometry,
  instances,
}: {
  cable: CableInstance;
  rack: RackConfig;
  geometry: RackGeometry;
  instances: readonly PlacedDevice[];
}) {
  const selected = useSelectionStore(
    (s) => s.selection?.kind === 'cable' && s.selection.cableId === cable.id,
  );
  const selectCable = useSelectionStore((s) => s.selectCable);
  const updateCable = useCableStore((s) => s.updateCable);
  const bundles = useCableStore((s) => s.bundles);
  const allCables = useCableStore((s) => s.cables);

  const spec = CABLE_CATALOG[cable.type];
  const bundle = cable.bundleId
    ? bundles.find((b) => b.id === cable.bundleId)
    : undefined;

  const srcInstance = instances.find(
    (i) => i.id === cable.source.deviceInstanceId,
  );
  const dstInstance = instances.find(
    (i) => i.id === cable.destination.deviceInstanceId,
  );
  const srcDefinition = srcInstance && getDevice(srcInstance.definitionId);
  const dstDefinition = dstInstance && getDevice(dstInstance.definitionId);

  // Bundle context: member index + loom spacing (derived, deterministic).
  const bundleContext = useMemo(() => {
    if (!bundle) return null;
    const members = bundleMembers(allCables, bundle.id);
    const index = members.findIndex((m) => m.id === cable.id);
    if (index < 0) return null;
    const maxDiameterMm = Math.max(...members.map((m) => m.thicknessMm), 1);
    return {
      slot: bundleSlot(index),
      spacingM: (maxDiameterMm + bundle.spacingMm) * MM_TO_M,
    };
  }, [bundle, allCables, cable.id]);

  // The route depends only on these serializable facts.
  const routeKey = [
    cable.type,
    cable.nominalLengthMm,
    cable.routingMode,
    cable.slackMode,
    cable.bundleId,
    bundleContext?.slot.join(','),
    bundleContext?.spacingM,
    (cable.waypointsMm ?? []).map((w) => w.join(',')).join(';'),
    srcInstance?.startU,
    srcInstance?.facing,
    dstInstance?.startU,
    dstInstance?.facing,
    geometry.railSpacingM,
    geometry.railBaseYM,
  ].join('|');

  const computed = useMemo(() => {
    if (!srcInstance || !dstInstance || !srcDefinition || !dstDefinition) {
      return null;
    }
    const source = resolveEndpoint(
      srcDefinition,
      srcInstance,
      geometry,
      cable.source.portRef,
    );
    const destination = resolveEndpoint(
      dstDefinition,
      dstInstance,
      geometry,
      cable.destination.portRef,
    );
    if (!source || !destination) return null;

    // Faceplate centers of mounted cable-management accessories.
    const managers: Vec3[] = instances
      .map((instance) => {
        const definition = getDevice(instance.definitionId);
        if (
          !definition ||
          (definition.accessoryKind !== 'cable-manager' &&
            definition.accessoryKind !== 'brush-panel')
        ) {
          return null;
        }
        return [
          0,
          geometry.railBaseYM + (instance.startU - 0.5) * U_METERS,
          geometry.frontRailZ,
        ] as Vec3;
      })
      .filter((p): p is Vec3 => p !== null);

    const route = computeRoute({
      source,
      destination,
      // Bundled cables always follow the professional loom discipline.
      // Manual mode without waypoints yet renders the auto route — the
      // sync effect below captures it as the initial editable shape.
      mode: bundleContext
        ? 'professional'
        : cable.routingMode === 'manual' && !cable.waypointsMm
          ? 'auto'
          : cable.routingMode,
      slack: cable.slackMode,
      nominalLengthMm: cable.nominalLengthMm,
      minBendRadiusMm: cable.bendRadiusMm,
      geometry,
      waypoints: cable.waypointsMm,
      cableManagerPoints: managers,
      topYM: geometry.railBaseYM + railHeight(rack.units),
    });

    // Loom offset applies to the shared run only — ends stay on-port.
    const points = bundleContext
      ? applyBundleOffset(
          route.points,
          3,
          route.points.length - 4,
          bundleContext.slot,
          bundleContext.spacingM,
        )
      : route.points;

    const collides =
      (route.resolvedMode === 'direct' || route.resolvedMode === 'natural') &&
      estimateRouteCollisions(
        points,
        instances,
        getDevice,
        geometry,
        [srcInstance.id, dstInstance.id],
      );

    // Validation targets the semantic route — loom offsets are a
    // rendering shift and must not skew the turn measurement.
    const check = checkCable(spec, source.port, destination.port, {
      minRouteLengthMm: route.minLengthMm,
      nominalLengthMm: cable.nominalLengthMm,
      bendRadiusOk: route.bendRadiusOk,
      maxTurnAngleDeg: maxTurnAngleDeg(route.points),
    });

    const status =
      check.level === 'invalid'
        ? ('invalid' as const)
        : check.level === 'warning' || collides
          ? ('warning' as const)
          : ('ok' as const);
    const statusMessage =
      check.level !== 'valid'
        ? check.message
        : collides
          ? 'Route passes through another chassis — try a side or top route.'
          : undefined;

    return { source, destination, route, points, status, statusMessage };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, instances, spec, geometry]);

  // Sync derived facts (route length, status) back to the serializable
  // instance — only when they actually changed, never per frame. A
  // fresh cable (calculatedRouteLengthMm 0) also receives the
  // recommended standard length for its measured route.
  useEffect(() => {
    if (!computed) return;
    const patch: Parameters<typeof updateCable>[1] = {};
    if (cable.calculatedRouteLengthMm === 0) {
      const recommended = recommendLengthMm(
        computed.route.minLengthMm,
        spec.standardLengthsMm,
      );
      if (cable.nominalLengthMm < recommended) {
        patch.nominalLengthMm = recommended;
      }
    }
    if (cable.calculatedRouteLengthMm !== computed.route.routeLengthMm) {
      patch.calculatedRouteLengthMm = computed.route.routeLengthMm;
    }
    // Entering manual mode: seed the editable waypoints from the shape
    // the cable currently has, so editing starts from what you see.
    if (cable.routingMode === 'manual' && !cable.waypointsMm) {
      patch.waypointsMm = computed.route.points.slice(
        3,
        computed.route.points.length - 3,
      ) as [number, number, number][];
    }
    if (
      cable.status !== computed.status ||
      cable.statusMessage !== computed.statusMessage
    ) {
      patch.status = computed.status;
      patch.statusMessage = computed.statusMessage;
    }
    if (Object.keys(patch).length > 0) updateCable(cable.id, patch);
  }, [computed, cable, spec, updateCable]);

  // Tube geometry from the engine cache: the sheath begins at each
  // plug's boot (the connector body covers the gap) and every corner
  // carries a true bend-radius fillet.
  const tube = useMemo(() => {
    if (!computed) return null;
    const points = computed.points.map((p) => [...p] as Vec3);
    if (points.length >= 2) {
      for (const [index, end] of [
        [0, computed.source],
        [points.length - 1, computed.destination],
      ] as const) {
        const offset =
          connectorCableOffsetMm(
            end.port.type,
            spec.category,
            end.port.insertionMm,
          ) * MM_TO_M;
        points[index] = [
          end.surface[0] + end.exitDir[0] * offset,
          end.surface[1] + end.exitDir[1] * offset,
          end.surface[2] + end.exitDir[2] * offset,
        ];
      }
    }
    return acquireTube(points, (cable.thicknessMm / 2) * MM_TO_M, spec.radialSegments, {
      minBendRadiusMm: cable.bendRadiusMm,
      stiffness: spec.stiffness,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, cable.thicknessMm, cable.bendRadiusMm, spec]);

  useEffect(() => {
    const key = tube?.key;
    return () => {
      if (key) releaseTube(key);
    };
  }, [tube]);

  // Connector-insertion animation for cables created this session.
  const born = useMemo(() => consumeBornAnimation(cable.id), [cable.id]);

  if (!computed || !tube) return null;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // While the Cable Tool is active, ports own the pointer — let the
    // event pass through to hit targets behind the tube.
    if (useUIStore.getState().activeTool === 'cable') return;
    e.stopPropagation();
    if (shouldSuppressClick() || e.delta > 4) return;
    selectCable(cable.id);
  };

  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (useUIStore.getState().activeTool === 'cable') return;
    e.stopPropagation();
    selectCable(cable.id);
    focusCable(cable.id);
  };

  const cableRadiusM = (cable.thicknessMm / 2) * MM_TO_M;
  const showLabels = cable.labelVisible || selected;

  return (
    <group>
      <mesh
        geometry={tube.geometry}
        material={sheathMaterial(
          cable.color,
          spec.roughness,
          spec.metalness ?? 0.08,
        )}
        castShadow
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
      {/* Subtle CAD-style selection sleeve */}
      {selected && (
        <mesh
          geometry={tube.geometry}
          material={SELECTION_MATERIAL}
          scale={1.001}
        />
      )}
      {/* Real connectors from the factory, noses seated in the jacks */}
      {([
        ['source', computed.source, 0] as const,
        ['destination', computed.destination, 1] as const,
      ]).map(([role, end]) => {
        let kind: ConnectorKind = connectorKindFor(end.port.type, spec.category);
        // Fiber LC↔SC variant terminates the destination with SC.
        if (
          role === 'destination' &&
          spec.category === 'fiber' &&
          cable.fiberConnector === 'lc-sc' &&
          kind === 'lc'
        ) {
          kind = 'sc';
        }
        const { Component } = connectorSpec(kind);
        const insertionM =
          connectorInsertionMm(end.port.type, spec.category, end.port.insertionMm) *
          MM_TO_M;
        const position: Vec3 = [
          end.surface[0] - end.exitDir[0] * insertionM,
          end.surface[1] - end.exitDir[1] * insertionM,
          end.surface[2] - end.exitDir[2] * insertionM,
        ];
        return (
          <PlugAt
            key={role}
            role={role}
            born={born}
            position={position}
            exitDir={end.exitDir}
          >
            <Component color={cable.color} cableRadiusM={cableRadiusM} />
          </PlugAt>
        );
      })}
      {/* Insertion animation drives the tube's draw range */}
      {born && <TubeBirth geometry={tube.geometry} />}
      {/* End labels: identity at both ends, color-coded */}
      {showLabels && cable.label && (
        <>
          {([computed.source, computed.destination] as const).map((end, i) => (
            <Html
              key={i}
              position={[
                end.anchor[0],
                end.anchor[1] + 0.02,
                end.anchor[2] + end.exitDir[2] * 0.012,
              ]}
              center
              style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  lineHeight: 1.3,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#e6ebf1',
                  background: 'rgba(10, 11, 13, 0.85)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  borderLeft: `3px solid ${cable.color}`,
                }}
              >
                {cable.label}
                <span style={{ opacity: 0.55 }}>
                  {' '}
                  · {i === 0 ? cable.source.portRef : cable.destination.portRef}
                </span>
              </div>
            </Html>
          ))}
        </>
      )}
    </group>
  );
}

/* ---- creation animation ----------------------------------------------- */

/** Insertion timing: total, and each plug's slide window. */
const BIRTH_S = 0.55;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Draws the tube in from source to destination over the birth window
 * by animating the geometry's index draw range. Draw range is reset to
 * full on completion (the geometry may later be shared via the cache).
 */
function TubeBirth({ geometry }: { geometry: TubeGeometry }) {
  const t0 = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    return () => geometry.setDrawRange(0, Infinity);
  }, [geometry]);

  useFrame(({ clock }) => {
    if (done.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = (clock.elapsedTime - t0.current) / BIRTH_S;
    const total = geometry.index?.count ?? Infinity;
    if (t >= 1) {
      geometry.setDrawRange(0, Infinity);
      done.current = true;
      return;
    }
    // Tube draws during the middle of the window (plugs lead/trail).
    const draw = easeOutCubic(Math.min(1, Math.max(0, (t - 0.12) / 0.76)));
    geometry.setDrawRange(0, Math.floor(total * draw));
  });

  return null;
}

/**
 * A connector at its seated pose. Newly created cables slide each plug
 * in along its exit direction — source first, destination as the tube
 * arrives — with a soft cubic ease.
 */
function PlugAt({
  role,
  born,
  position,
  exitDir,
  children,
}: {
  role: 'source' | 'destination';
  born: boolean;
  position: Vec3;
  exitDir: Vec3;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const t0 = useRef<number | null>(null);
  const done = useRef(!born);
  /** Slide-in distance, meters. */
  const SLIDE = 0.014;
  const win: [number, number] = role === 'source' ? [0, 0.35] : [0.62, 1];

  useFrame(({ clock }) => {
    if (done.current || !ref.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = (clock.elapsedTime - t0.current) / BIRTH_S;
    const local = Math.min(1, Math.max(0, (t - win[0]) / (win[1] - win[0])));
    const eased = easeOutCubic(local);
    const back = SLIDE * (1 - eased);
    ref.current.position.set(
      position[0] + exitDir[0] * back,
      position[1] + exitDir[1] * back,
      position[2] + exitDir[2] * back,
    );
    ref.current.visible = t >= win[0];
    if (t >= 1) {
      ref.current.position.set(...position);
      ref.current.visible = true;
      done.current = true;
    }
  });

  return (
    <group
      ref={ref}
      position={position}
      quaternion={plugQuaternion(exitDir)}
      visible={!born}
    >
      {children}
    </group>
  );
}
