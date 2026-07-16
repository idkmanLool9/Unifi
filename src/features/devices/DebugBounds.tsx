import { useRef, useState, type RefObject } from 'react';
import { Box3, Group, Matrix4, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useImportReportStore } from './import/importReportStore';

/**
 * Development-only physical-normalization overlay, enabled by adding
 * ?debugBounds to the URL. Per mounted device it renders:
 *
 * - measured bounding box of the rendered model (blue) vs the expected
 *   box from the manufacturer spec (green)
 * - the device-local origin (RGB axes) and forward vector (+Z arrow)
 * - the universal-import report: transform source and values, detected
 *   origin placement, measured dimensions and per-axis deviation
 *
 * Ships inert — query-param gated, nothing renders in normal use.
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
  /** Definition id, to surface the universal-import report. */
  definitionId?: string;
}

const fmtVec = (v: readonly number[]) => `[${v.map((n) => +n.toFixed(1)).join(', ')}]`;

export function DebugBounds({
  target,
  expectedMm,
  label,
  definitionId,
}: DebugBoundsProps) {
  const [measured, setMeasured] = useState<MeasuredBox | null>(null);
  const frame = useRef(0);
  const report = useImportReportStore((s) =>
    definitionId !== undefined ? s.reports[definitionId] : undefined,
  );

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
        import: report && {
          source: report.transformSource,
          origin: report.origin,
          quarterTurn: report.quarterTurn,
          rotationDeg: report.transform.rotationDeg,
          offsetMm: report.transform.offsetMm,
          deviations: report.checks.map(
            (c) => `${c.axis} ${c.deviationPct > 0 ? '+' : ''}${c.deviationPct}%`,
          ),
        },
      });
    }
  });

  const halfW = expectedMm[0] / 2000;
  const halfD = expectedMm[2] / 2000;
  const arrowLen = halfD + 0.05;
  const worst = report?.checks.reduce(
    (max, c) => (Math.abs(c.deviationPct) > Math.abs(max) ? c.deviationPct : max),
    0,
  );

  return (
    <>
      {/* Measured (blue) vs expected (green) boxes */}
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

      {/* Device-local origin (RGB axes) */}
      <axesHelper args={[0.09]} />

      {/* Forward vector: +Z out of the faceplate */}
      <Line
        points={[
          [0, 0, 0],
          [0, 0, arrowLen],
        ]}
        color="#e8a33d"
        lineWidth={2}
      />
      <mesh position={[0, 0, arrowLen]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.008, 0.024, 12]} />
        <meshBasicMaterial color="#e8a33d" toneMapped={false} />
      </mesh>

      {/* Import-report card */}
      {report && (
        <Html
          position={[halfW + 0.05, 0, 0]}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div
            style={{
              fontSize: 9,
              lineHeight: 1.5,
              fontFamily: 'ui-monospace, monospace',
              color: '#c9d2dc',
              background: 'rgba(10, 11, 13, 0.85)',
              padding: '4px 7px',
              borderRadius: 5,
              border: `1px solid ${report.warnings.length ? '#e5544b' : '#2a2f36'}`,
            }}
          >
            <div>
              transform: {report.transformSource}
              {report.quarterTurn ? ' (¼-turn)' : ''} · origin: {report.origin}
            </div>
            <div>
              rot {fmtVec(report.transform.rotationDeg)} · off{' '}
              {fmtVec(report.transform.offsetMm)} mm
            </div>
            <div>
              measured {fmtVec(report.finalSizeMm)} / spec {fmtVec(expectedMm)} mm
            </div>
            <div style={{ color: report.warnings.length ? '#e5544b' : '#3fb970' }}>
              max deviation {worst !== undefined && worst > 0 ? '+' : ''}
              {worst?.toFixed(2)}%
              {report.warnings.length ? ' ⚠ out of tolerance' : ''}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
