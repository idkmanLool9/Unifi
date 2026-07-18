import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  type TubeGeometry,
} from 'three';
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
import { applyBundleOffset, bundleSlot, loomRadiusM } from './engine/bundles';
import {
  buildRoutingGraph,
  occupancyFromCables,
  planManagedRoute,
} from './engine/managedRouting';
import { minFilletRadiusM } from './engine/spline';
import { CABLE_CATALOG } from './cableCatalog';
import { checkCable, formatLength } from './compatibility';
import {
  computeRoute,
  estimateRouteCollisions,
  recommendLengthMm,
} from './routing';
import { useRoutingRulesStore } from '@/stores/routingRulesStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { poseForEndpoint } from '@/features/devices/instancePose';
import { focusCable } from '@/features/viewport/focusActions';
import { railHeight, U_METERS } from '@/features/rack/rackConstants';
import { MM_TO_M, type PlacedDevice, type RackGeometry } from '@/features/rack/rackMath';
import {
  bundleMembers,
  consumeBornAnimation,
  useBundleHighlightStore,
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
const BUNDLE_HIGHLIGHT_MATERIAL = new MeshStandardMaterial({
  color: '#e0a23f',
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});
/** Velcro strap wrap. */
const STRAP_GEOMETRY = new CylinderGeometry(1, 1, 1, 18);
STRAP_GEOMETRY.rotateX(Math.PI / 2); // axis onto Z
const STRAP_MATERIAL = new MeshStandardMaterial({
  color: '#16181c',
  roughness: 0.85,
  metalness: 0.02,
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
  const repairEndpoints = useCableStore((s) => s.repairEndpoints);
  const bundles = useCableStore((s) => s.bundles);
  const allCables = useCableStore((s) => s.cables);

  const rules = useRoutingRulesStore((s) => s.rules);
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
      index,
      count: members.length,
      spacingM: (maxDiameterMm + bundle.spacingMm) * MM_TO_M,
    };
  }, [bundle, allCables, cable.id]);

  // Occupancy of every routing node by OTHER cables (their persisted
  // routed keys) — this cable's own usage never penalizes itself.
  const occupancySignature = allCables
    .map((c) => (c.id === cable.id ? '' : (c.routedNodeKeys ?? []).join(',')))
    .join(';');

  // The route depends only on these serializable facts.
  const routeKey = [
    cable.source.portRef,
    cable.destination.portRef,
    cable.type,
    cable.nominalLengthMm,
    cable.routingMode,
    cable.slackMode,
    cable.bundleId,
    bundleContext?.slot.join(','),
    bundleContext?.spacingM,
    (cable.waypointsMm ?? []).map((w) => w.join(',')).join(';'),
    cable.viaInstanceId,
    cable.ignoreManagers,
    rules.managerPreference,
    rules.separatePowerData,
    rules.dacMaxLengthMm,
    occupancySignature,
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
      poseForEndpoint(srcInstance, instances, geometry),
    );
    const destination = resolveEndpoint(
      dstDefinition,
      dstInstance,
      geometry,
      cable.destination.portRef,
      poseForEndpoint(dstInstance, instances, geometry),
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

    // Managed routing: plan through the node graph whenever hardware is
    // placed and the mode allows it. The plan feeds computeRoute as the
    // 'managed' core; when the graph offers nothing useful the cable
    // falls back to the unmanaged disciplines.
    const baseMode =
      cable.routingMode === 'manual' && !cable.waypointsMm
        ? 'auto'
        : cable.routingMode;
    const wantsManaged =
      !cable.ignoreManagers &&
      (baseMode === 'auto' || baseMode === 'managed' || baseMode === 'cable-manager');
    const graph = buildRoutingGraph(instances, getDevice, geometry);
    const plan = wantsManaged
      ? planManagedRoute(source, destination, graph, {
          family: spec.category,
          rules,
          occupancy: occupancyFromCables(allCables, cable.id),
          forceInstanceId: cable.viaInstanceId,
          managerBoost: baseMode === 'cable-manager' ? 2.2 : 1,
          // Bundle members lie side by side inside the slot.
          slotOffsetM: bundleContext
            ? (bundleContext.index - (bundleContext.count - 1) / 2) *
              bundleContext.spacingM
            : 0,
        })
      : null;
    const useManaged = plan !== null && plan.nodeKeys.length > 0;

    const route = computeRoute({
      source,
      destination,
      // Bundled cables without a managed plan follow the professional
      // loom discipline; managed plans win even inside bundles.
      mode: useManaged
        ? 'managed'
        : bundleContext
          ? 'professional'
          : baseMode === 'managed' || baseMode === 'cable-manager'
            ? 'auto'
            : baseMode,
      slack: cable.slackMode,
      nominalLengthMm: cable.nominalLengthMm,
      minBendRadiusMm: cable.bendRadiusMm,
      geometry,
      waypoints: cable.waypointsMm,
      managedPoints: plan?.core,
      cableManagerPoints: managers,
      topYM: geometry.railBaseYM + railHeight(rack.units),
    });

    // Loom offset applies to the shared run only — ends stay on-port.
    // Managed routes already separate members along the slot axis; the
    // hex loom offset is for unmanaged runs.
    const points =
      bundleContext && !useManaged
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

    // Validation measures what actually renders: the fillet stage's
    // achieved bend radius. A route is only flagged when the rendered
    // sheath truly bends tighter than 85% of its rating — raw polyline
    // knots that the fillets round away are not violations.
    const achievedRadiusMm =
      minFilletRadiusM(route.points, {
        minBendRadiusMm: cable.bendRadiusMm,
        stiffness: spec.stiffness,
      }) / MM_TO_M;
    const check = checkCable(spec, source.port, destination.port, {
      minRouteLengthMm: route.minLengthMm,
      nominalLengthMm: cable.nominalLengthMm,
      bendRadiusOk: achievedRadiusMm >= cable.bendRadiusMm * 0.7,
    });

    // Separation / capacity / rule findings become actionable warnings.
    const ruleWarnings = [...(plan?.warnings ?? [])];
    if (
      spec.category === 'dac' &&
      route.routeLengthMm > rules.dacMaxLengthMm
    ) {
      ruleWarnings.push(
        `DAC runs should stay under ${formatLength(rules.dacMaxLengthMm)} — consider fiber for this ${formatLength(route.routeLengthMm)} route.`,
      );
    }

    const status =
      check.level === 'invalid'
        ? ('invalid' as const)
        : check.level === 'warning' || collides || ruleWarnings.length > 0
          ? ('warning' as const)
          : ('ok' as const);
    const statusMessage =
      check.level !== 'valid'
        ? check.message
        : ruleWarnings[0] ??
          (collides
            ? 'Route passes through another chassis — try a side or top route.'
            : undefined);

    return {
      source,
      destination,
      route,
      points,
      status,
      statusMessage,
      routedNodeKeys: useManaged ? plan.nodeKeys : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, instances, spec, geometry]);

  // Sync derived facts (route length, status) back to the serializable
  // instance — only when they actually changed, never per frame. A
  // fresh cable (calculatedRouteLengthMm 0) also receives the
  // recommended standard length for its measured route.
  useEffect(() => {
    if (!computed) return;
    const patch: Parameters<typeof updateCable>[1] = {};
    // Endpoint resolution can repair a ref that drifted through historic
    // authoring saves — persist the healed value so the cable stays
    // visible without re-repairing on every load.
    if (
      computed.source.port.ref !== cable.source.portRef ||
      computed.destination.port.ref !== cable.destination.portRef
    ) {
      repairEndpoints(cable.id, {
        sourcePortRef:
          computed.source.port.ref !== cable.source.portRef
            ? computed.source.port.ref
            : undefined,
        destinationPortRef:
          computed.destination.port.ref !== cable.destination.portRef
            ? computed.destination.port.ref
            : undefined,
      });
    }
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
    // Persist which routing nodes this route occupies (capacity math).
    const routedKey = computed.routedNodeKeys.join('|');
    if ((cable.routedNodeKeys ?? []).join('|') !== routedKey) {
      patch.routedNodeKeys = computed.routedNodeKeys;
    }
    if (
      cable.status !== computed.status ||
      cable.statusMessage !== computed.statusMessage
    ) {
      patch.status = computed.status;
      patch.statusMessage = computed.statusMessage;
    }
    if (Object.keys(patch).length > 0) updateCable(cable.id, patch);
  }, [computed, cable, spec, updateCable, repairEndpoints]);

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
  const bundleHighlighted = useBundleHighlightStore(
    (s) => s.highlightBundleId !== null && s.highlightBundleId === cable.bundleId,
  );

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
      {bundleHighlighted && !selected && (
        <mesh
          geometry={tube.geometry}
          material={BUNDLE_HIGHLIGHT_MATERIAL}
          scale={1.002}
        />
      )}
      {/* Velcro straps: rendered once per bundle, by the loom's center
          member, wrapping the whole loom at regular intervals. */}
      {bundle &&
        bundle.straps !== false &&
        bundleContext?.slot[0] === 0 &&
        bundleContext?.slot[1] === 0 && (
          <BundleStraps
            points={computed.points}
            radiusM={
              loomRadiusM(
                allCables
                  .filter((c) => c.bundleId === bundle.id)
                  .map((c) => c.thicknessMm),
                bundle.spacingMm,
              ) + 0.0012
            }
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

/* ---- velcro straps ---------------------------------------------------- */

/** Strap spacing along the loom, meters. */
const STRAP_INTERVAL_M = 0.16;
/** Strap width, meters. */
const STRAP_WIDTH_M = 0.012;

/**
 * Velcro wraps at regular intervals along the loom's shared run
 * (between the exits — never on the fan-out to individual ports).
 */
function BundleStraps({ points, radiusM }: { points: Vec3[]; radiusM: number }) {
  const straps = useMemo(() => {
    const core = points.slice(2, points.length - 2);
    const out: Array<{ position: Vec3; tangent: Vec3 }> = [];
    let travelled = 0;
    let next = STRAP_INTERVAL_M / 2;
    for (let i = 1; i < core.length; i++) {
      const a = core[i - 1];
      const b = core[i];
      const segment = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (segment < 1e-9) continue;
      while (travelled + segment >= next) {
        const t = (next - travelled) / segment;
        out.push({
          position: [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ],
          tangent: [
            (b[0] - a[0]) / segment,
            (b[1] - a[1]) / segment,
            (b[2] - a[2]) / segment,
          ],
        });
        next += STRAP_INTERVAL_M;
      }
      travelled += segment;
    }
    return out;
  }, [points]);

  return (
    <>
      {straps.map((strap, i) => (
        <mesh
          key={i}
          geometry={STRAP_GEOMETRY}
          material={STRAP_MATERIAL}
          position={strap.position}
          quaternion={plugQuaternion(strap.tangent)}
          scale={[radiusM, radiusM, STRAP_WIDTH_M]}
        />
      ))}
    </>
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
