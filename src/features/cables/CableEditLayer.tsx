import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Group,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector3,
} from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { resolveEndpoint, type Vec3 } from './anchors';
import { getDevice } from '@/features/devices/deviceRegistry';
import { poseForEndpoint } from '@/features/devices/instancePose';
import { useCableStore, type CableInstance } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { RackGeometry } from '@/features/rack/rackMath';

/**
 * Manual routing editor. When the selected cable is in Manual mode its
 * waypoints become draggable control points: drag to move (on a
 * camera-facing plane through the grabbed point), click a ghost
 * midpoint to insert, double-click a point to delete. The route
 * re-renders live through the same engine as every other cable —
 * manual cables are ordinary cables whose core the user owns.
 */

const HANDLE_GEOMETRY = new SphereGeometry(0.008, 16, 12);
const HANDLE_MATERIAL = new MeshBasicMaterial({
  color: '#4c82f7',
  toneMapped: false,
  depthTest: false,
  transparent: true,
  opacity: 0.95,
});
const HANDLE_HOVER_MATERIAL = new MeshBasicMaterial({
  color: '#9dbcff',
  toneMapped: false,
  depthTest: false,
  transparent: true,
  opacity: 1,
});
const GHOST_MATERIAL = new MeshBasicMaterial({
  color: '#8a8f99',
  toneMapped: false,
  transparent: true,
  opacity: 0.45,
  depthTest: false,
});

export function CableEditLayer({ geometry }: { geometry: RackGeometry }) {
  const cableId = useSelectionStore((s) =>
    s.selection?.kind === 'cable' ? s.selection.cableId : null,
  );
  const cable = useCableStore((s) =>
    cableId ? s.cables.find((c) => c.id === cableId) : undefined,
  );
  if (!cable || cable.routingMode !== 'manual' || !cable.waypointsMm) {
    return null;
  }
  return <WaypointHandles cable={cable} geometry={geometry} />;
}

function WaypointHandles({
  cable,
  geometry,
}: {
  cable: CableInstance;
  geometry: RackGeometry;
}) {
  const updateCable = useCableStore((s) => s.updateCable);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const groupRef = useRef<Group>(null);
  const dragPlane = useRef(new Plane());
  const localRay = useMemo(() => new Raycaster(), []);
  const hit = useMemo(() => new Vector3(), []);

  const waypoints = cable.waypointsMm ?? [];

  // The exits anchor the ghost midpoints at both ends of the run.
  const exits = useMemo(() => {
    const ends: Vec3[] = [];
    for (const end of [cable.source, cable.destination]) {
      const instance = instances.find((i) => i.id === end.deviceInstanceId);
      const definition = instance && getDevice(instance.definitionId);
      if (!instance || !definition) return null;
      const resolved = resolveEndpoint(
        definition,
        instance,
        geometry,
        end.portRef,
        poseForEndpoint(instance, instances, geometry),
      );
      if (!resolved) return null;
      ends.push(resolved.anchor);
    }
    return ends as [Vec3, Vec3];
  }, [cable.source, cable.destination, instances, geometry]);

  // Dragging owns the camera.
  useEffect(() => {
    if (!controls) return;
    controls.enabled = dragIndex === null;
    return () => {
      controls.enabled = true;
    };
  }, [dragIndex, controls]);

  // Global pointer-up ends the drag wherever it happens.
  useEffect(() => {
    if (dragIndex === null) return;
    const up = () => setDragIndex(null);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [dragIndex]);

  // Drag: project the pointer onto the camera-facing plane through the
  // grabbed point (world space), convert back to rack-local, and write
  // the waypoint to the store — the cable re-routes live through the
  // normal render path.
  useFrame(() => {
    const group = groupRef.current;
    if (dragIndex === null || !group) return;
    localRay.setFromCamera(pointer, camera);
    if (!localRay.ray.intersectPlane(dragPlane.current, hit)) return;
    group.worldToLocal(hit);
    const next = waypoints.map((w, i) =>
      i === dragIndex
        ? ([hit.x, hit.y, hit.z] as [number, number, number])
        : w,
    );
    updateCable(cable.id, { waypointsMm: next });
  });

  const beginDrag = (index: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as { setPointerCapture?: (id: number) => void })
      .setPointerCapture?.(e.pointerId);
    const group = groupRef.current;
    if (!group) return;
    const p = waypoints[index];
    const world = group.localToWorld(new Vector3(p[0], p[1], p[2]));
    dragPlane.current.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new Vector3()).negate(),
      world,
    );
    setDragIndex(index);
  };

  const deletePoint = (index: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    updateCable(cable.id, {
      waypointsMm: waypoints.filter((_, i) => i !== index),
    });
  };

  const insertAt = (index: number, position: Vec3) => (
    e: ThreeEvent<MouseEvent>,
  ) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const next = [...waypoints];
    next.splice(index, 0, [position[0], position[1], position[2]]);
    updateCable(cable.id, { waypointsMm: next });
  };

  // Ghost midpoints: between exits and waypoints, and between pairs.
  const ghosts: Array<{ index: number; position: Vec3 }> = [];
  if (exits) {
    const chain: Vec3[] = [exits[0], ...waypoints, exits[1]];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i];
      const b = chain[i + 1];
      ghosts.push({
        index: i,
        position: [
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
          (a[2] + b[2]) / 2,
        ],
      });
    }
  }

  return (
    <group ref={groupRef} renderOrder={10}>
      {waypoints.map((point, i) => (
        <mesh
          key={`wp-${i}`}
          geometry={HANDLE_GEOMETRY}
          material={
            i === hoverIndex || i === dragIndex
              ? HANDLE_HOVER_MATERIAL
              : HANDLE_MATERIAL
          }
          position={point}
          onPointerDown={beginDrag(i)}
          onDoubleClick={deletePoint(i)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoverIndex(i);
          }}
          onPointerOut={() =>
            setHoverIndex((current) => (current === i ? null : current))
          }
        />
      ))}
      {ghosts.map((ghost) => (
        <mesh
          key={`ghost-${ghost.index}`}
          geometry={HANDLE_GEOMETRY}
          material={GHOST_MATERIAL}
          position={ghost.position}
          scale={0.62}
          onClick={insertAt(ghost.index, ghost.position)}
        />
      ))}
    </group>
  );
}
