import { TubeGeometry } from 'three';
import { centerlineCurve, polylineLengthM, type SplineOptions } from './spline';
import type { Vec3 } from '../anchors';

/**
 * Cable Engine — geometry stage. Tube geometries are expensive to
 * build and identical routes are common (undo/redo, re-selection,
 * unrelated re-renders), so every geometry is cached by its exact
 * inputs with reference counting. A geometry is disposed only when the
 * last cable using it releases it; acquiring a cached entry costs a
 * map lookup.
 */

interface CacheEntry {
  geometry: TubeGeometry;
  refs: number;
}

const cache = new Map<string, CacheEntry>();

/** Rendered tube quality: segments per meter of route (clamped). */
const SEGMENTS_PER_M = 110;
const MIN_SEGMENTS = 24;
const MAX_SEGMENTS = 260;

const keyOf = (
  points: Vec3[],
  radiusM: number,
  radialSegments: number,
  options: SplineOptions,
): string => {
  let key = `${radiusM.toFixed(5)}|${radialSegments}|${options.minBendRadiusMm}|${options.stiffness}`;
  for (const p of points) {
    key += `|${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
  }
  return key;
};

export interface AcquiredTube {
  geometry: TubeGeometry;
  key: string;
}

/** Builds (or reuses) the tube for a route centerline. */
export function acquireTube(
  points: Vec3[],
  radiusM: number,
  radialSegments: number,
  options: SplineOptions,
): AcquiredTube {
  const key = keyOf(points, radiusM, radialSegments, options);
  const hit = cache.get(key);
  if (hit) {
    hit.refs += 1;
    return { geometry: hit.geometry, key };
  }
  const curve = centerlineCurve(points, options);
  const lengthM = polylineLengthM(points);
  const segments = Math.round(
    Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, lengthM * SEGMENTS_PER_M)),
  );
  const geometry = new TubeGeometry(curve, segments, radiusM, radialSegments, false);
  cache.set(key, { geometry, refs: 1 });
  return { geometry, key };
}

/** Releases a previously acquired tube; disposes on the last release. */
export function releaseTube(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.geometry.dispose();
    cache.delete(key);
  }
}

/** Test/diagnostics hook. */
export function tubeCacheSize(): number {
  return cache.size;
}
