import { CatmullRomCurve3, Vector3 } from 'three';
import { MM_TO_M } from '@/features/rack/rackMath';
import type { Vec3 } from '../anchors';

/**
 * Cable Engine — spline stage. Takes the routing engine's semantic
 * polyline and produces the physically believable centerline a real
 * sheath would follow: every corner is replaced by a circular arc
 * whose radius honors the cable's minimum bend radius (scaled up by
 * sheath stiffness), clamped to what the adjacent segments can host.
 * The result is deterministic, dense enough to render smoothly, and
 * cheap enough to recompute only when the route itself changes.
 */

export interface SplineOptions {
  /** Cable minimum bend radius, mm. */
  minBendRadiusMm: number;
  /** Sheath stiffness 0..1 — stiff cables bend wider than the minimum. */
  stiffness: number;
}

const v = (p: Vec3) => new Vector3(p[0], p[1], p[2]);

/** Arc sampling: one point every ~12° of turn. */
const ARC_STEP_RAD = (12 * Math.PI) / 180;

/**
 * The fillet radius a cable of this stiffness naturally takes, meters.
 * Stiffness widens the curve beyond the spec minimum — a DAC never
 * folds at its rated minimum unless forced.
 */
export function naturalBendRadiusM(options: SplineOptions): number {
  return options.minBendRadiusMm * MM_TO_M * (1 + options.stiffness);
}

/**
 * Merges interior knots that continue (nearly) straight on, so a
 * chain like surface→anchor→exit counts as ONE long runway for the
 * fillets on either side of it.
 */
function mergeCollinear(points: Vec3[]): Vec3[] {
  if (points.length < 3) return points;
  const out: Vec3[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    if (l1 < 1e-9) continue;
    if (l2 < 1e-9) {
      out.push(b);
      continue;
    }
    const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (l1 * l2);
    if (cos > 0.9995) continue;
    out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Replaces every interior corner of the polyline with a sampled
 * circular arc tangent to both segments. The radius starts at the
 * cable's natural bend radius and shrinks only when the neighboring
 * segments are too short to host it (never below 20% — a visible tight
 * bend is more honest than a kink). Collinear corners merge first so
 * straight chains contribute their full length as fillet runway.
 */
export function filletPolyline(rawPoints: Vec3[], options: SplineOptions): Vec3[] {
  const points = mergeCollinear(rawPoints);
  if (points.length < 3) return points.map((p) => [...p] as Vec3);

  const out: Vec3[] = [[...points[0]] as Vec3];
  const targetR = naturalBendRadiusM(options);

  for (let i = 1; i < points.length - 1; i++) {
    const a = v(points[i - 1]);
    const b = v(points[i]);
    const c = v(points[i + 1]);
    const inDir = b.clone().sub(a);
    const outDir = c.clone().sub(b);
    const inLen = inDir.length();
    const outLen = outDir.length();
    if (inLen < 1e-6 || outLen < 1e-6) continue;
    inDir.divideScalar(inLen);
    outDir.divideScalar(outLen);

    const dot = Math.min(1, Math.max(-1, inDir.dot(outDir)));
    const turn = Math.acos(dot);
    if (turn < 0.05) {
      // Effectively straight — keep the knot as-is.
      out.push([...points[i]] as Vec3);
      continue;
    }
    if (Math.PI - turn < 0.05) {
      // Hairpin: no tangent arc exists; keep the knot (validation
      // flags this route through the bend-angle check).
      out.push([...points[i]] as Vec3);
      continue;
    }

    // Tangent offset t = r·tan(θ/2); shrink r if segments can't host it
    // (each segment is shared by up to two fillets — use half).
    let radius = targetR;
    const maxT = Math.min(inLen / 2, outLen / 2) * 0.95;
    const wantT = radius * Math.tan(turn / 2);
    if (wantT > maxT) {
      radius = Math.max(maxT / Math.tan(turn / 2), targetR * 0.2);
    }
    const t = radius * Math.tan(turn / 2);

    const start = b.clone().addScaledVector(inDir, -t);
    const end = b.clone().addScaledVector(outDir, t);

    // Arc center: from the arc start, perpendicular to the incoming
    // direction, toward the inside of the corner (the bend plane's
    // normal is in×out).
    const normal = inDir.clone().cross(outDir).normalize();
    const toCenter = normal.clone().cross(inDir).normalize();
    const center = start.clone().addScaledVector(toCenter, radius);

    // Sample the arc from start to end around the center.
    const startVec = start.clone().sub(center);
    const endVec = end.clone().sub(center);
    const sweep = startVec.angleTo(endVec);
    const steps = Math.max(2, Math.ceil(sweep / ARC_STEP_RAD));
    for (let s = 0; s <= steps; s++) {
      const q = startVec
        .clone()
        .applyAxisAngle(normal, (sweep * s) / steps)
        .add(center);
      out.push([q.x, q.y, q.z]);
    }
  }

  out.push([...points[points.length - 1]] as Vec3);
  return out;
}

/**
 * The smallest bend radius the fillet stage actually achieves on this
 * route, meters — the physically honest "does this cable bend too
 * tight" metric. Corners whose neighboring segments can't host the
 * natural radius shrink it (down to the 20% floor); this reports the
 * worst case. Infinity for corner-free routes.
 */
export function minFilletRadiusM(
  rawPoints: Vec3[],
  options: SplineOptions,
): number {
  const points = mergeCollinear(rawPoints);
  if (points.length < 3) return Infinity;
  const targetR = naturalBendRadiusM(options);
  let min = Infinity;
  for (let i = 1; i < points.length - 1; i++) {
    const a = v(points[i - 1]);
    const b = v(points[i]);
    const c = v(points[i + 1]);
    const inDir = b.clone().sub(a);
    const outDir = c.clone().sub(b);
    const inLen = inDir.length();
    const outLen = outDir.length();
    if (inLen < 1e-6 || outLen < 1e-6) continue;
    inDir.divideScalar(inLen);
    outDir.divideScalar(outLen);
    const dot = Math.min(1, Math.max(-1, inDir.dot(outDir)));
    const turn = Math.acos(dot);
    if (turn < 0.05 || Math.PI - turn < 0.05) continue;
    let radius = targetR;
    const maxT = Math.min(inLen / 2, outLen / 2) * 0.95;
    const wantT = radius * Math.tan(turn / 2);
    if (wantT > maxT) {
      radius = Math.max(maxT / Math.tan(turn / 2), targetR * 0.2);
    }
    min = Math.min(min, radius);
  }
  return min;
}

/**
 * The renderable centerline curve. Chordal Catmull-Rom through the
 * filleted points: passes exactly through every sample with no
 * overshoot, so the straight runs stay straight and the arcs stay
 * round.
 */
export function centerlineCurve(
  points: Vec3[],
  options: SplineOptions,
): CatmullRomCurve3 {
  const dense = filletPolyline(points, options);
  return new CatmullRomCurve3(
    dense.map((p) => new Vector3(...p)),
    false,
    'chordal',
  );
}

/** Total polyline length, meters. */
export function polylineLengthM(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 1][2],
    );
  }
  return total;
}

/**
 * The sharpest direction change in the semantic polyline, degrees —
 * validation compares it against the profile's maxBendAngleDeg.
 */
export function maxTurnAngleDeg(points: Vec3[]): number {
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const v1 = v(points[i]).sub(v(points[i - 1]));
    const v2 = v(points[i + 1]).sub(v(points[i]));
    if (v1.lengthSq() < 1e-12 || v2.lengthSq() < 1e-12) continue;
    const angle = v1.angleTo(v2);
    max = Math.max(max, angle);
  }
  return (max * 180) / Math.PI;
}
