import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

/**
 * Close-up visibility: while the camera is near its target, rack
 * structure (uprights, frame, plinth) sitting between the camera and
 * the orbit target fades to a ghost so ports and cables stay workable.
 *
 * Restrained by design: only structural rack meshes ever fade (never
 * devices or cables), materials swap to one memoized translucent twin
 * per structural material (no clones per frame), the check runs on a
 * throttle against a handful of meshes, everything restores the moment
 * the camera backs off, and the whole behavior sits behind the "Fade
 * obstructions" view setting. Saved visibility state is never touched.
 */

/** Camera-to-target distance below which fading activates, meters. */
export const FADE_ACTIVE_DISTANCE = 0.7;
/** Frames between obstruction checks. */
const CHECK_INTERVAL_FRAMES = 8;
const FADED_OPACITY = 0.16;

interface ObstructionFaderProps {
  groupRef: RefObject<Group | null>;
  /** The rack's structural materials — the only fade candidates. */
  materials: readonly MeshStandardMaterial[];
}

export function ObstructionFader({ groupRef, materials }: ObstructionFaderProps) {
  const enabled = useViewSettingsStore((s) => s.fadeObstructions);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null;

  const frame = useRef(0);
  const faded = useRef(new Map<Mesh, MeshStandardMaterial>());
  const raycaster = useMemo(() => new Raycaster(), []);
  const target = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);

  // One translucent twin per structural material, created once.
  const fadedTwins = useMemo(() => {
    const twins = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    for (const material of materials) {
      const twin = material.clone();
      twin.transparent = true;
      twin.opacity = FADED_OPACITY;
      twin.depthWrite = false;
      twins.set(material, twin);
    }
    return twins;
  }, [materials]);
  useEffect(
    () => () => fadedTwins.forEach((twin) => twin.dispose()),
    [fadedTwins],
  );

  const restoreAll = () => {
    faded.current.forEach((original, mesh) => {
      mesh.material = original;
    });
    faded.current.clear();
  };

  // Restore instantly when the setting turns off or the rack unmounts.
  useEffect(() => {
    if (!enabled) restoreAll();
    return restoreAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useFrame(() => {
    if (!enabled || !controls || !groupRef.current) return;
    frame.current += 1;
    if (frame.current % CHECK_INTERVAL_FRAMES !== 0) return;

    controls.getTarget(target);
    const camDistance = camera.position.distanceTo(target);
    if (camDistance > FADE_ACTIVE_DISTANCE) {
      if (faded.current.size > 0) restoreAll();
      return;
    }

    // Structural meshes are exactly those wearing a rack material.
    const structural: Mesh[] = [];
    groupRef.current.traverse((node) => {
      if (
        node instanceof Mesh &&
        (fadedTwins.has(node.material as MeshStandardMaterial) ||
          faded.current.has(node))
      ) {
        structural.push(node);
      }
    });

    direction.copy(target).sub(camera.position).normalize();
    raycaster.set(camera.position, direction);
    raycaster.far = camDistance - 0.02;
    const hits = raycaster.intersectObjects(structural, false);
    const obstructing = new Set(hits.map((hit) => hit.object as Mesh));

    // Fade newly obstructing meshes; restore the rest.
    for (const mesh of structural) {
      const isFaded = faded.current.has(mesh);
      if (obstructing.has(mesh) && !isFaded) {
        const original = mesh.material as MeshStandardMaterial;
        const twin = fadedTwins.get(original);
        if (twin) {
          faded.current.set(mesh, original);
          mesh.material = twin;
        }
      } else if (!obstructing.has(mesh) && isFaded) {
        mesh.material = faded.current.get(mesh)!;
        faded.current.delete(mesh);
      }
    }
  });

  return null;
}
