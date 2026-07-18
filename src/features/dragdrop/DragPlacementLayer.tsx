import { useMemo, useRef } from 'react';
import { Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { chooseSlot, snapStartU } from './snapping';
import { getDevice } from '@/features/devices/deviceRegistry';
import { instancePose } from '@/features/devices/instancePose';
import { railHeight, RACK_DIMS } from '@/features/rack/rackConstants';
import {
  isShelfDefinition,
  rotatedFootprintMm,
  shelfDeckRect,
  validateSurfacePlacement,
  MM_TO_M,
  SHELF_DECK_TOP_MM,
  type RackGeometry,
  type SurfacePlacement,
} from '@/features/rack/rackMath';
import {
  placementContext,
  shelfChildren,
  useDeviceInstancesStore,
} from '@/stores/deviceInstancesStore';
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
  const shelfMeshes = useRef(new Map<string, Mesh>());
  const instances = useDeviceInstancesStore((s) => s.instances);

  // One raycast quad per mounted shelf deck (desktop devices only land
  // on shelves; rack gear ignores these and snaps to the rails).
  const shelves = useMemo(
    () =>
      instances
        .map((instance) => {
          const definition = getDevice(instance.definitionId);
          if (!definition || !isShelfDefinition(definition)) return null;
          const pose = instancePose(instance, instances, geometry);
          if (!pose) return null;
          const deck = shelfDeckRect(definition);
          return {
            id: instance.id,
            pose,
            deckW: deck.wMm * MM_TO_M,
            deckD: deck.dMm * MM_TO_M,
            deckLocalY:
              (-definition.heightMm / 2 + SHELF_DECK_TOP_MM) * MM_TO_M,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [instances, geometry],
  );

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

    // Desktop (non-rack) hardware lands on shelf decks when the pointer
    // is over one; the rails remain the fallback surface.
    if (definition.mountingStandard !== 'eia-310' && shelfMeshes.current.size > 0) {
      const deckHits = raycaster.intersectObjects(
        [...shelfMeshes.current.values()],
        false,
      );
      const deckHit = deckHits[0];
      if (deckHit) {
        const shelfId = deckHit.object.userData.shelfId as string;
        const state = useDeviceInstancesStore.getState();
        const shelfInstance = state.instances.find((i) => i.id === shelfId);
        const shelfDefinition =
          shelfInstance && getDevice(shelfInstance.definitionId);
        if (shelfInstance && shelfDefinition) {
          local.copy(deckHit.point);
          deckHit.object.parent!.worldToLocal(local);
          const stepMm = drag.precise ? 1 : 5;
          const source = drag.source;
          const rotationDeg =
            source.kind === 'instance'
              ? (state.instances.find((i) => i.id === source.instanceId)
                  ?.surface?.rotationDeg ?? 0)
              : 0;
          const deck = shelfDeckRect(shelfDefinition);
          const foot = rotatedFootprintMm(
            definition.widthMm,
            definition.depthMm,
            rotationDeg,
          );
          const clampAxis = (valueMm: number, spanMm: number) => {
            const half = Math.max(0, spanMm / 2);
            return Math.min(half, Math.max(-half, valueMm));
          };
          const xMm =
            Math.round(
              clampAxis(local.x / MM_TO_M, deck.wMm - foot.wMm) / stepMm,
            ) * stepMm;
          const zMm =
            Math.round(
              clampAxis(local.z / MM_TO_M, deck.dMm - foot.dMm) / stepMm,
            ) * stepMm;
          const surface: SurfacePlacement = {
            shelfId,
            xMm,
            zMm,
            rotationDeg,
          };
          const ignoreId =
            drag.source.kind === 'instance' && !drag.source.duplicate
              ? drag.source.instanceId
              : undefined;
          const check = validateSurfacePlacement(
            definition,
            surface,
            shelfDefinition,
            shelfChildren(state.instances, shelfId),
            ignoreId,
          );
          const validation = check.ok
            ? ({ ok: true, startU: shelfInstance.startU } as const)
            : ({
                ok: false,
                reason: 'occupied',
                message: check.message,
              } as const);
          const target = drag.target;
          if (
            !target?.surface ||
            target.surface.shelfId !== shelfId ||
            target.surface.xMm !== xMm ||
            target.surface.zMm !== zMm ||
            drag.validation?.ok !== validation.ok
          ) {
            drag.setTarget(
              {
                rackId: rack.id,
                startU: shelfInstance.startU,
                facing: shelfInstance.facing,
                surface: { shelfId, xMm, zMm },
              },
              validation,
            );
          }
          heldStartU.current = null;
          return;
        }
      }
    }

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
      target.surface !== undefined ||
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
      {/* Shelf deck catch surfaces (desktop hardware lands here). */}
      {shelves.map((shelf) => (
        <group
          key={shelf.id}
          position={shelf.pose.position}
          rotation={[0, shelf.pose.rotationY, 0]}
        >
          <mesh
            position={[0, shelf.deckLocalY, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            userData={{ shelfId: shelf.id }}
            ref={(mesh) => {
              if (mesh) shelfMeshes.current.set(shelf.id, mesh);
              else shelfMeshes.current.delete(shelf.id);
            }}
          >
            <planeGeometry args={[shelf.deckW, shelf.deckD]} />
            <meshBasicMaterial side={2} colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
