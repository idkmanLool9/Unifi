import { useEffect, useMemo, useRef } from 'react';
import { Color, Group, Mesh, MeshStandardMaterial, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import { DeviceModel } from '@/features/devices/DeviceModel';
import { MountingHardware } from '@/features/devices/MountingHardware';
import { getDevice } from '@/features/devices/deviceRegistry';
import { instancePose } from '@/features/devices/instancePose';
import { U_METERS, RACK_DIMS } from '@/features/rack/rackConstants';
import {
  devicePlacement,
  uSlotY,
  type DevicePose,
  type RackGeometry,
} from '@/features/rack/rackMath';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useDragStore, type DragTarget } from '@/stores/dragStore';

/**
 * Real-time ghost preview inside the rack group. Renders the actual
 * device subtree — real GLB via the shared cache (or the parametric
 * placeholder) plus its mechanical mounting hardware — at the exact
 * placement the drop would produce, then overrides every mesh material
 * with one shared translucent "hologram" material tinted by validation
 * state. Geometry stays true; only the surface is ghosted. Restrained
 * by design: transparency, rail-span accents, no glow.
 */

const GHOST_COLORS = {
  valid: new Color('#3fb970'),
  invalid: new Color('#e5544b'),
  neutral: new Color('#93a0b4'),
} as const;

/** Positional smoothing (higher = snappier). */
const SNAP_DAMP = 18;

export function GhostDevice({ geometry }: { geometry: RackGeometry }) {
  const source = useDragStore((s) => s.source);
  const target = useDragStore((s) => s.target);
  if (!source || !target) return null;
  return <GhostBody geometry={geometry} definitionId={source.definitionId} />;
}

/** Pose the drop would produce: rails snap, or a spot on a shelf deck. */
function ghostPose(
  definitionId: string,
  target: DragTarget,
  drag: { source: { kind: string; instanceId?: string } | null },
  geometry: RackGeometry,
): DevicePose | null {
  const definition = getDevice(definitionId);
  if (!definition) return null;
  if (target.surface) {
    const instances = useDeviceInstancesStore.getState().instances;
    const rotationDeg =
      (drag.source?.kind === 'instance' &&
        instances.find((i) => i.id === drag.source?.instanceId)?.surface
          ?.rotationDeg) ||
      0;
    return instancePose(
      {
        id: '__ghost__',
        definitionId,
        startU: target.startU,
        facing: target.facing,
        visible: true,
        surface: {
          shelfId: target.surface.shelfId,
          xMm: target.surface.xMm,
          zMm: target.surface.zMm,
          rotationDeg,
        },
      },
      instances,
      geometry,
    );
  }
  return devicePlacement(definition, target.startU, target.facing, geometry);
}

function GhostBody({
  geometry,
  definitionId,
}: {
  geometry: RackGeometry;
  definitionId: string;
}) {
  const groupRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const definition = getDevice(definitionId);

  const ghostMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        transparent: true,
        opacity: 0.42,
        roughness: 0.55,
        metalness: 0.2,
        depthWrite: false,
      }),
    [],
  );
  const accentMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        emissiveIntensity: 0.4,
      }),
    [],
  );
  useEffect(
    () => () => {
      ghostMaterial.dispose();
      accentMaterial.dispose();
    },
    [ghostMaterial, accentMaterial],
  );

  const placedOnce = useRef(false);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const drag = useDragStore.getState();
    if (!group || !definition || !drag.target) return;

    // Tint by validation state — one shared material, color set in place.
    const state = drag.validation?.ok ? 'valid' : drag.validation ? 'invalid' : 'neutral';
    ghostMaterial.color.copy(GHOST_COLORS[state]);
    accentMaterial.color.copy(GHOST_COLORS[state]);
    accentMaterial.emissive.copy(GHOST_COLORS[state]);

    // Ghost every mesh in the subtree (GLB streams in async, so this is
    // idempotent per frame: assign only when a mesh isn't ghosted yet).
    modelRef.current?.traverse((node) => {
      if (node instanceof Mesh && node.material !== ghostMaterial) {
        node.material = ghostMaterial;
        node.castShadow = false;
        node.receiveShadow = false;
      }
    });

    const pose = ghostPose(definition.id, drag.target, drag, geometry);
    if (!pose) return;
    const { position, rotationY } = pose;
    if (!placedOnce.current) {
      group.position.set(...position);
      group.rotation.y = rotationY;
      placedOnce.current = true;
      return;
    }
    group.position.x = MathUtils.damp(group.position.x, position[0], SNAP_DAMP, delta);
    group.position.y = MathUtils.damp(group.position.y, position[1], SNAP_DAMP, delta);
    group.position.z = MathUtils.damp(group.position.z, position[2], SNAP_DAMP, delta);
    group.rotation.y = MathUtils.damp(group.rotation.y, rotationY, SNAP_DAMP, delta);
  });

  if (!definition) return null;

  return (
    <>
      <group ref={groupRef}>
        <group ref={modelRef}>
          <DeviceModel definition={definition} />
          <MountingHardware definition={definition} geometry={geometry} />
        </group>
      </group>
      <RailSpanAccentsWhenOnRails
        geometry={geometry}
        definitionUnits={definition.rackUnits}
        material={accentMaterial}
      />
    </>
  );
}

/** Rail accents only apply to rail drops — shelf spots have no U span. */
function RailSpanAccentsWhenOnRails(props: {
  geometry: RackGeometry;
  definitionUnits: number;
  material: MeshStandardMaterial;
}) {
  const onShelf = useDragStore((s) => s.target?.surface !== undefined);
  if (onShelf) return null;
  return <RailSpanAccents {...props} />;
}

/** Translucent bars over the rails marking the occupied U range. */
function RailSpanAccents({
  geometry,
  definitionUnits,
  material,
}: {
  geometry: RackGeometry;
  definitionUnits: number;
  material: MeshStandardMaterial;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    const drag = useDragStore.getState();
    if (!group || !drag.target) return;
    const y =
      uSlotY(drag.target.startU, geometry.railBaseYM) +
      (definitionUnits * U_METERS) / 2;
    group.position.y = y;
    const z =
      drag.target.facing === 'front'
        ? geometry.frontRailZ + 0.002
        : geometry.rearRailZ - 0.002;
    group.position.z = z;
    group.rotation.y = drag.target.facing === 'front' ? 0 : Math.PI;
  });

  const barH = definitionUnits * U_METERS - 0.003;
  const barX = RACK_DIMS.opening / 2 + RACK_DIMS.uprightW / 2;

  return (
    <group ref={groupRef}>
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * barX, 0, 0]} material={material}>
          <planeGeometry args={[RACK_DIMS.uprightW * 0.9, barH]} />
        </mesh>
      ))}
    </group>
  );
}
