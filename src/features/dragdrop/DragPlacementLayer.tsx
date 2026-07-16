import { useMemo, useRef } from 'react';
import { Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { chooseSlot, snapStartU } from './snapping';
import { getDevice } from '@/features/devices/deviceRegistry';
import { railHeight, RACK_DIMS } from '@/features/rack/rackConstants';
import { type RackGeometry } from '@/features/rack/rackMath';
import { placementContext, useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useDragStore } from '@/stores/dragStore';
import type { RackConfig, RackOrientation } from '@/types';

/**
 * Invisible raycast surfaces for drag placement, mounted inside the
 * rack's (animated, orientation-rotated) group so hits arrive in the
 * canonical rack coordinate system for free. One plane per mounting
 * side; the closest hit decides front vs rear. All slot math delegates
 * to snapping.ts / rackMath — nothing is recomputed in UI code.
 *
 * Per-frame work while dragging: one raycast against exactly two
 * quads plus a store write when the target actually changes. Idle: the
 * component renders nothing.
 */

/** Horizontal margin around the opening that still counts as the rack. */
const CATCH_MARGIN_X = 0.06;
/** Vertical margin below U1 / above the top unit that still catches. */
const CATCH_MARGIN_Y = 0.05;

const raycaster = new Raycaster();
const ndc = new Vector2();
const local = new Vector3();

interface DragPlacementLayerProps {
  rack: RackConfig;
  geometry: RackGeometry;
}

export function DragPlacementLayer({ rack, geometry }: DragPlacementLayerProps) {
  const dragging = useDragStore((s) => s.phase === 'dragging');
  if (!dragging) return null;
  return <PlacementSurfaces rack={rack} geometry={geometry} />;
}

function PlacementSurfaces({ rack, geometry }: DragPlacementLayerProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const frontRef = useRef<Mesh>(null);
  const rearRef = useRef<Mesh>(null);
  const heldStartU = useRef<number | null>(null);

  const railH = railHeight(rack.units);
  const planeW = RACK_DIMS.opening + 2 * CATCH_MARGIN_X;
  const planeH = railH + 2 * CATCH_MARGIN_Y;
  const planeY = geometry.railBaseYM + railH / 2;

  const planes = useMemo(
    () =>
      [
        { key: 'front' as RackOrientation, z: geometry.frontRailZ, ref: frontRef },
        { key: 'rear' as RackOrientation, z: geometry.rearRailZ, ref: rearRef },
      ] as const,
    [geometry.frontRailZ, geometry.rearRailZ],
  );

  useFrame(() => {
    const drag = useDragStore.getState();
    if (drag.phase !== 'dragging' || !drag.source) return;
    const front = frontRef.current;
    const rear = rearRef.current;
    if (!front || !rear) return;

    const definition = getDevice(drag.source.definitionId);
    if (!definition) return;

    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((drag.pointer.x - rect.left) / rect.width) * 2 - 1,
      -((drag.pointer.y - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([front, rear], false);
    const hit = hits[0];

    if (!hit) {
      if (drag.target !== null) {
        heldStartU.current = null;
        drag.setTarget(null, null);
      }
      return;
    }

    const facing: RackOrientation = hit.object === front ? 'front' : 'rear';
    // Into rack-local space: the surfaces live inside the rack group, so
    // the group's orientation/entrance animation is inverted for free.
    local.copy(hit.point);
    hit.object.parent!.worldToLocal(local);

    const startU = snapStartU(
      local.y,
      heldStartU.current,
      definition.rackUnits,
      rack.units,
      geometry.railBaseYM,
    );

    const ctx = placementContext(
      useDeviceInstancesStore.getState().instances,
    );
    if (!ctx) return;

    const ignoreInstanceId =
      drag.source.kind === 'instance' && !drag.source.duplicate
        ? drag.source.instanceId
        : undefined;
    const { startU: chosenU, validation } = chooseSlot(startU, definition, ctx, {
      precise: drag.precise,
      ignoreInstanceId,
    });
    heldStartU.current = chosenU;

    const target = drag.target;
    if (
      !target ||
      target.startU !== chosenU ||
      target.facing !== facing ||
      target.rackId !== rack.id ||
      drag.validation?.ok !== validation.ok
    ) {
      drag.setTarget({ rackId: rack.id, startU: chosenU, facing }, validation);
    }
  });

  return (
    <group>
      {planes.map(({ key, z, ref }) => (
        <mesh key={key} ref={ref} position={[0, planeY, z]}>
          <planeGeometry args={[planeW, planeH]} />
          {/* Raycastable but never drawn (material.visible must stay true
              for Mesh.raycast; colorWrite/depthWrite keep it invisible). */}
          <meshBasicMaterial side={2} colorWrite={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
