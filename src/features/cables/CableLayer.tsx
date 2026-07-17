import { useEffect, useMemo } from 'react';
import {
  CatmullRomCurve3,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { resolveEndpoint, type Vec3 } from './anchors';
import {
  cableStartOffsetMm,
  DEFAULT_INSERTION_MM,
  GENERIC_INSERTION_MM,
  GenericPlug,
  plugQuaternion,
  Rj45Plug,
} from './Rj45Plug';
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
import { useCableStore, type CableInstance } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { shouldSuppressClick } from '@/stores/dragStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
import type { RackConfig } from '@/types';

/**
 * Cable rendering, inside the rack group (so rack orientation and
 * animation are inherited). Each cable derives its route from semantic
 * state — endpoints resolve through the canonical anchor utility, the
 * curve is memoized on exactly the inputs that can change it, and
 * sheath materials are shared per (color, finish) across all cables.
 */

/* Shared sheath materials, keyed by color|roughness. */
const sheathMaterials = new Map<string, MeshStandardMaterial>();
function sheathMaterial(color: string, roughness: number): MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let material = sheathMaterials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.08,
    });
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

  const spec = CABLE_CATALOG[cable.type];

  const srcInstance = instances.find(
    (i) => i.id === cable.source.deviceInstanceId,
  );
  const dstInstance = instances.find(
    (i) => i.id === cable.destination.deviceInstanceId,
  );
  const srcDefinition = srcInstance && getDevice(srcInstance.definitionId);
  const dstDefinition = dstInstance && getDevice(dstInstance.definitionId);

  // The route depends only on these serializable facts.
  const routeKey = [
    cable.type,
    cable.nominalLengthMm,
    cable.routingMode,
    cable.slackMode,
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
      mode: cable.routingMode,
      slack: cable.slackMode,
      nominalLengthMm: cable.nominalLengthMm,
      minBendRadiusMm: cable.bendRadiusMm,
      geometry,
      waypoints: cable.waypointsMm,
      cableManagerPoints: managers,
      topYM: geometry.railBaseYM + railHeight(rack.units),
    });

    const collides =
      (route.resolvedMode === 'direct' || route.resolvedMode === 'natural') &&
      estimateRouteCollisions(
        route.points,
        instances,
        getDevice,
        geometry,
        [srcInstance.id, dstInstance.id],
      );

    const check = checkCable(spec, source.port, destination.port, {
      minRouteLengthMm: route.minLengthMm,
      nominalLengthMm: cable.nominalLengthMm,
      bendRadiusOk: route.bendRadiusOk,
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

    return { source, destination, route, status, statusMessage };
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
    if (
      cable.status !== computed.status ||
      cable.statusMessage !== computed.statusMessage
    ) {
      patch.status = computed.status;
      patch.statusMessage = computed.statusMessage;
    }
    if (Object.keys(patch).length > 0) updateCable(cable.id, patch);
  }, [computed, cable, spec, updateCable]);

  const tube = useMemo(() => {
    if (!computed) return null;
    const points = computed.route.points.map((p) => new Vector3(...p));
    // The sheath begins at the plug's boot, not at the panel face —
    // the connector body covers the gap, so nothing clips through the
    // hardware and the cable leaves along the true exit direction.
    if (points.length >= 2) {
      for (const [index, end] of [
        [0, computed.source],
        [points.length - 1, computed.destination],
      ] as const) {
        const offset =
          cableStartOffsetMm(end.port.type, end.port.insertionMm) * MM_TO_M;
        points[index] = new Vector3(...end.surface).addScaledVector(
          new Vector3(...end.exitDir),
          offset,
        );
      }
    }
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.6);
    const segments = Math.min(120, Math.max(32, points.length * 10));
    return new TubeGeometry(
      curve,
      segments,
      (cable.thicknessMm / 2) * MM_TO_M,
      12,
      false,
    );
  }, [computed, cable.thicknessMm]);

  useEffect(() => () => tube?.dispose(), [tube]);

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

  return (
    <group>
      <mesh
        geometry={tube}
        material={sheathMaterial(cable.color, spec.roughness)}
        castShadow
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
      {/* Subtle CAD-style selection sleeve */}
      {selected && (
        <mesh geometry={tube} material={SELECTION_MATERIAL} scale={1.001} />
      )}
      {/* Real connectors, noses inserted into the jacks */}
      {[computed.source, computed.destination].map((end, i) => {
        const insertionM =
          (end.port.insertionMm ??
            DEFAULT_INSERTION_MM[end.port.type] ??
            GENERIC_INSERTION_MM) * MM_TO_M;
        const position: Vec3 = [
          end.surface[0] - end.exitDir[0] * insertionM,
          end.surface[1] - end.exitDir[1] * insertionM,
          end.surface[2] - end.exitDir[2] * insertionM,
        ];
        const copper = end.port.type in DEFAULT_INSERTION_MM;
        return (
          <group
            key={i}
            position={position}
            quaternion={plugQuaternion(end.exitDir)}
          >
            {copper ? (
              <Rj45Plug color={cable.color} cableRadiusM={cableRadiusM} />
            ) : (
              <GenericPlug color={cable.color} cableRadiusM={cableRadiusM} />
            )}
          </group>
        );
      })}
    </group>
  );
}
