import type { Vec3 } from '../anchors';

/**
 * Cable Engine — bundle stage. Cables sharing a bundle run as one loom:
 * every member follows the same professional route shape, laterally
 * offset in the plane perpendicular to the run by a deterministic
 * hex-packed slot. Offsets apply only to the route's core (the shared
 * run) — ends always converge back to their own ports, so the loom
 * visibly merges after leaving the connectors and splits before
 * arriving.
 */

/** Outer radius of a hex-packed loom, meters. */
export function loomRadiusM(
  diametersMm: readonly number[],
  spacingMm: number,
): number {
  const count = diametersMm.length;
  if (count === 0) return 0;
  const maxD = Math.max(...diametersMm);
  const rings = count <= 1 ? 0 : count <= 7 ? 1 : count <= 19 ? 2 : 3;
  return ((maxD * (1 + 2 * rings)) / 2 + spacingMm * rings) * 0.001;
}

/**
 * Hex circle-packing slot for a member: slot 0 is the loom center,
 * slots 1–6 the first ring, 7–18 the second, and so on. Returns the
 * 2D offset in loom cross-section units of `spacing` (center distance
 * between neighboring sheaths).
 */
export function bundleSlot(index: number): [number, number] {
  if (index === 0) return [0, 0];
  let ring = 1;
  let first = 1;
  while (index >= first + ring * 6) {
    first += ring * 6;
    ring += 1;
  }
  const posInRing = index - first;
  const angle = ((Math.PI * 2) / (ring * 6)) * posInRing + (ring % 2) * 0.3;
  return [Math.cos(angle) * ring, Math.sin(angle) * ring];
}

/**
 * Applies the member's loom offset to the route's core points (indices
 * `coreStart`..`coreEnd`, inclusive). The offset lives in the plane
 * perpendicular to the overall core direction; the basis is built
 * deterministically so every member of a bundle agrees on it.
 */
export function applyBundleOffset(
  points: Vec3[],
  coreStart: number,
  coreEnd: number,
  slot: [number, number],
  spacingM: number,
): Vec3[] {
  if (coreEnd <= coreStart || (slot[0] === 0 && slot[1] === 0)) return points;
  const a = points[coreStart];
  const b = points[coreEnd];
  const dir: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...dir);
  if (len < 1e-6) return points;
  const d: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];

  // Perpendicular basis: prefer world-up as the reference; fall back to
  // world-z for vertical runs. u = d × ref, v = d × u.
  const ref: Vec3 = Math.abs(d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u: Vec3 = [
    d[1] * ref[2] - d[2] * ref[1],
    d[2] * ref[0] - d[0] * ref[2],
    d[0] * ref[1] - d[1] * ref[0],
  ];
  const uLen = Math.hypot(...u);
  const un: Vec3 = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
  const v: Vec3 = [
    d[1] * un[2] - d[2] * un[1],
    d[2] * un[0] - d[0] * un[2],
    d[0] * un[1] - d[1] * un[0],
  ];

  const ox = slot[0] * spacingM;
  const oy = slot[1] * spacingM;
  return points.map((p, i) => {
    if (i < coreStart || i > coreEnd) return p;
    return [
      p[0] + un[0] * ox + v[0] * oy,
      p[1] + un[1] * ox + v[1] * oy,
      p[2] + un[2] * ox + v[2] * oy,
    ] as Vec3;
  });
}
