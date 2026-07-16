import { Box3, Matrix4, Mesh, type Object3D } from 'three';
import type { DeviceDefinition, ModelTransform } from '../deviceSchema';

/**
 * Universal device-import pipeline. Every GLB — regardless of
 * manufacturer — passes through the same deterministic steps:
 *
 *   1. read metadata           (deviceRegistry / manifest)
 *   2. load GLB                (DeviceModel via drei cache)
 *   3. measure raw bounds      (measureObjectMm)
 *   4. detect local origin     (classifyOrigin)
 *   5. detect forward axis     (detectQuarterTurn — spec axis matching)
 *   6. generate default xform  (defaultTransform)
 *   7. apply metadata override (resolveTransform — explicit wins verbatim)
 *   8. validate dimensions     (checkDimensions — warnings, never scaling)
 *   9. register the result     (importReportStore)
 *
 * Everything here is a pure function of the model geometry and the
 * definition: the same GLB always produces the same final transform.
 * The engine never scales, stretches, or modifies the source asset —
 * a dimension mismatch is reported, not corrected.
 */

/** Axis-aligned bounds of a model, in millimeters, in its local space. */
export interface MeasuredBoundsMm {
  size: [number, number, number];
  center: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

/** How the source model is positioned relative to its own origin. */
export type OriginPlacement = 'centered' | 'base' | 'offset';

export type DimensionAxis = 'width' | 'height' | 'depth';

export interface DimensionCheck {
  axis: DimensionAxis;
  expectedMm: number;
  measuredMm: number;
  /** Signed deviation as a percentage of the expected value. */
  deviationPct: number;
  withinTolerance: boolean;
}

/** Deviation (in % of spec) above which a dimension warning is raised. */
export const DIMENSION_TOLERANCE_PCT = 2;

export interface ImportReport {
  definitionId: string;
  /** Where the final transform came from. */
  transformSource: 'auto' | 'metadata';
  transform: ModelTransform;
  /** Raw model bounds, before any correction. */
  rawBounds: MeasuredBoundsMm;
  origin: OriginPlacement;
  /** True when the model was authored width-along-Z and auto-rotated. */
  quarterTurn: boolean;
  /** Model size after the final transform, per spec axis. */
  finalSizeMm: [number, number, number];
  checks: DimensionCheck[];
  warnings: string[];
}

const IDENTITY_ROTATION: [number, number, number] = [0, 0, 0];
/** Yaw applied when a model is authored with its width along Z. */
const QUARTER_TURN_DEG: [number, number, number] = [0, -90, 0];

/**
 * Geometry-level AABB of an object in its own local space, in mm.
 * Walks mesh geometries (not object bounds) so it survives nested node
 * transforms, and is measured relative to `root` so world placement and
 * animation never leak into the result.
 */
export function measureObjectMm(root: Object3D): MeasuredBoundsMm | null {
  root.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(root.matrixWorld).invert();
  const box = new Box3();
  const relative = new Matrix4();
  let empty = true;

  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.computeBoundingBox();
    const geometryBox = node.geometry.boundingBox;
    if (!geometryBox) return;
    relative.multiplyMatrices(toLocal, node.matrixWorld);
    const meshBox = geometryBox.clone().applyMatrix4(relative);
    if (empty) {
      box.copy(meshBox);
      empty = false;
    } else {
      box.union(meshBox);
    }
  });
  if (empty) return null;

  const toMm = (v: number) => v * 1000;
  return {
    size: [
      toMm(box.max.x - box.min.x),
      toMm(box.max.y - box.min.y),
      toMm(box.max.z - box.min.z),
    ],
    center: [
      toMm((box.min.x + box.max.x) / 2),
      toMm((box.min.y + box.max.y) / 2),
      toMm((box.min.z + box.max.z) / 2),
    ],
    min: [toMm(box.min.x), toMm(box.min.y), toMm(box.min.z)],
    max: [toMm(box.max.x), toMm(box.max.y), toMm(box.max.z)],
  };
}

/**
 * Classifies where the author put the model's origin. Tolerances scale
 * per axis with the model so exporter noise never flips the result.
 */
export function classifyOrigin(bounds: MeasuredBoundsMm): OriginPlacement {
  const tol = bounds.size.map((s) => Math.max(2, s * 0.02));
  const [cx, cy, cz] = bounds.center;
  const horizontallyCentered =
    Math.abs(cx) <= tol[0] && Math.abs(cz) <= tol[2];
  if (horizontallyCentered && Math.abs(cy) <= tol[1]) return 'centered';
  if (horizontallyCentered && Math.abs(bounds.min[1]) <= tol[1]) return 'base';
  return 'offset';
}

/**
 * Detects a model authored with its width along Z (depth along X) by
 * comparing both axis assignments against the manufacturer spec. The
 * assignment with the smaller relative error wins; ties keep the model
 * as authored. Only the horizontal plane is considered — height is
 * unambiguous.
 */
export function detectQuarterTurn(
  bounds: MeasuredBoundsMm,
  definition: Pick<DeviceDefinition, 'widthMm' | 'depthMm'>,
): boolean {
  const [x, , z] = bounds.size;
  const relError = (measured: number, expected: number) =>
    expected > 0 ? Math.abs(measured - expected) / expected : 0;
  const asAuthored =
    relError(x, definition.widthMm) + relError(z, definition.depthMm);
  const rotated =
    relError(z, definition.widthMm) + relError(x, definition.depthMm);
  return rotated < asAuthored;
}

/** Rotates local bounds by the quarter turn (yaw -90°): x' = -z, z' = x. */
function rotateBounds(bounds: MeasuredBoundsMm): MeasuredBoundsMm {
  const [sx, sy, sz] = bounds.size;
  const [cx, cy, cz] = bounds.center;
  const size: [number, number, number] = [sz, sy, sx];
  const center: [number, number, number] = [-cz, cy, cx];
  return {
    size,
    center,
    min: [center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2],
    max: [center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + size[2] / 2],
  };
}

/**
 * The deterministic default transform: rotate width onto X when the
 * model was authored sideways, then translate the (rotated) bounds
 * center to the origin — device-local convention is chassis center at
 * the origin, front toward +Z. Scale is always 1: dimensions are
 * validated, never corrected.
 *
 * The one thing geometry cannot reveal is which end is the faceplate —
 * a 180° flip. That is exactly what an explicit metadata modelTransform
 * is for.
 */
export function defaultTransform(
  bounds: MeasuredBoundsMm,
  definition: Pick<DeviceDefinition, 'widthMm' | 'depthMm'>,
): { transform: ModelTransform; quarterTurn: boolean } {
  const quarterTurn = detectQuarterTurn(bounds, definition);
  const oriented = quarterTurn ? rotateBounds(bounds) : bounds;
  // `|| 0` normalizes -0 so equal inputs are bytewise-equal outputs.
  const round = (v: number) => Math.round(v * 100) / 100 || 0;
  return {
    quarterTurn,
    transform: {
      scale: 1,
      rotationDeg: quarterTurn ? QUARTER_TURN_DEG : IDENTITY_ROTATION,
      offsetMm: [
        round(-oriented.center[0]),
        round(-oriented.center[1]),
        round(-oriented.center[2]),
      ],
    },
  };
}

/**
 * Final transform for a device: explicit metadata wins verbatim;
 * otherwise the measured default applies.
 */
export function resolveTransform(
  definition: DeviceDefinition,
  bounds: MeasuredBoundsMm,
): { transform: ModelTransform; source: 'auto' | 'metadata'; quarterTurn: boolean } {
  if (definition.modelTransform !== undefined) {
    return {
      transform: definition.modelTransform,
      source: 'metadata',
      quarterTurn: false,
    };
  }
  const { transform, quarterTurn } = defaultTransform(bounds, definition);
  return { transform, source: 'auto', quarterTurn };
}

/** Model size after a transform, expressed on the spec's W×H×D axes.
 *  Exact for the 90°-step rotations the pipeline produces. */
export function transformedSizeMm(
  bounds: MeasuredBoundsMm,
  transform: ModelTransform,
): [number, number, number] {
  const scale: [number, number, number] =
    typeof transform.scale === 'number'
      ? [transform.scale, transform.scale, transform.scale]
      : transform.scale;
  const scaled: [number, number, number] = [
    bounds.size[0] * scale[0],
    bounds.size[1] * scale[1],
    bounds.size[2] * scale[2],
  ];
  // Normalize yaw to 90° steps; odd quarter turns swap X and Z extents.
  const yawQuarter = Math.round(((transform.rotationDeg[1] % 360) + 360) / 90) % 4;
  return yawQuarter % 2 === 1 ? [scaled[2], scaled[1], scaled[0]] : scaled;
}

/**
 * Compares the transformed model against the manufacturer spec.
 * Deviations beyond the tolerance produce warnings — the pipeline never
 * silently rescales a model to make it fit.
 */
export function checkDimensions(
  finalSizeMm: [number, number, number],
  definition: Pick<DeviceDefinition, 'widthMm' | 'heightMm' | 'depthMm'>,
  tolerancePct: number = DIMENSION_TOLERANCE_PCT,
): DimensionCheck[] {
  const axes: Array<{ axis: DimensionAxis; expected: number; measured: number }> = [
    { axis: 'width', expected: definition.widthMm, measured: finalSizeMm[0] },
    { axis: 'height', expected: definition.heightMm, measured: finalSizeMm[1] },
    { axis: 'depth', expected: definition.depthMm, measured: finalSizeMm[2] },
  ];
  return axes.map(({ axis, expected, measured }) => {
    const deviationPct =
      expected > 0 ? ((measured - expected) / expected) * 100 : 0;
    return {
      axis,
      expectedMm: Math.round(expected * 10) / 10,
      measuredMm: Math.round(measured * 10) / 10,
      deviationPct: Math.round(deviationPct * 100) / 100,
      withinTolerance: Math.abs(deviationPct) <= tolerancePct,
    };
  });
}

/**
 * Runs the measurement stages of the pipeline for a loaded model and
 * produces the full import report. Returns null when the object holds
 * no measurable geometry (the caller falls back to the placeholder).
 */
export function buildImportReport(
  definition: DeviceDefinition,
  model: Object3D,
): ImportReport | null {
  const rawBounds = measureObjectMm(model);
  if (!rawBounds) return null;

  const origin = classifyOrigin(rawBounds);
  const { transform, source, quarterTurn } = resolveTransform(
    definition,
    rawBounds,
  );
  const finalSizeMm = transformedSizeMm(rawBounds, transform);
  const checks = checkDimensions(finalSizeMm, definition);

  const warnings = checks
    .filter((check) => !check.withinTolerance)
    .map(
      (check) =>
        `${check.axis}: expected ${check.expectedMm} mm, measured ` +
        `${check.measuredMm} mm (${check.deviationPct > 0 ? '+' : ''}` +
        `${check.deviationPct}%)`,
    );

  return {
    definitionId: definition.id,
    transformSource: source,
    transform,
    rawBounds,
    origin,
    quarterTurn,
    finalSizeMm,
    checks,
    warnings,
  };
}
