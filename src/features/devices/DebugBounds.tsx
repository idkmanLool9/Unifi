import { useRef, useState, type RefObject } from 'react';
import { Box3, Group, Matrix4, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Development-only physical-normalization overlay, enabled by adding
 * ?debugBounds to the URL. Renders two wireframes per mounted device —
 * the measured bounding box of the rendered model (blue) and the
 * expected box from the device's metadata dimensions (green) — and logs
 * the measured W×H×D in millimeters. Disabled by default; ships inert.
 */
export const DEBUG_BOUNDS_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debugBounds');

interface MeasuredBox {
  size: [number, number, number];
  center: [number, number, number];
}

/** Bounding box of `target`'s meshes in target-local space (immune to
 *  rack/facing animation, unlike a world-space Box3.setFromObject). */
function measureLocalBox(target: Group): MeasuredBox | null {
  target.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(target.matrixWorld).invert();
  const box = new Box3();
  const relative = new Matrix4();

  target.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.computeBoundingBox();
      const b = box.isEmpty() ? box : new Box3();
      relative.multiplyMatrices(toLocal, node.matrixWorld);
      const meshBox = node.geometry.boundingBox!.clone().applyMatrix4(relative);
      if (b === box) box.copy(meshBox);
      else box.union(meshBox);
    }
  });
  if (box.isEmpty()) return null;
  return {
    size: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
    center: [
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (box.min.z + box.max.z) / 2,
    ],
  };
}

interface DebugBoundsProps {
  target: RefObject<Group | null>;
  /** Expected physical size from metadata, in millimeters. */
  expectedMm: [number, number, number];
  label: string;
}

export function DebugBounds({ target, expectedMm, label }: DebugBoundsProps) {
  const [measured, setMeasured] = useState<MeasuredBox | null>(null);
  const frame = useRef(0);

  // Re-measure periodically: the GLB streams in asynchronously.
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 30 !== 1 || !target.current) return;
    const next = measureLocalBox(target.current);
    if (!next) return;
    const changed =
      !measured ||
      next.size.some((v, i) => Math.abs(v - measured.size[i]) > 0.0001);
    if (changed) {
      setMeasured(next);
      const mm = next.size.map((v) => (v * 1000).toFixed(1)).join(' × ');
      console.info(`[bounds] ${label}: rendered W×H×D = ${mm} mm`, {
        centerMm: next.center.map((v) => Math.round(v * 1000)),
      });
    }
  });

  return (
    <>
      {measured && (
        <mesh position={measured.center}>
          <boxGeometry args={measured.size} />
          <meshBasicMaterial color="#4c82f7" wireframe toneMapped={false} />
        </mesh>
      )}
      <mesh>
        <boxGeometry
          args={[expectedMm[0] / 1000, expectedMm[1] / 1000, expectedMm[2] / 1000]}
        />
        <meshBasicMaterial
          color="#3fb970"
          wireframe
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
