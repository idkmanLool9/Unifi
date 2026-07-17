import { describe, expect, it } from 'vitest';
import {
  centerlineCurve,
  filletPolyline,
  maxTurnAngleDeg,
  naturalBendRadiusM,
} from './spline';
import { acquireTube, releaseTube, tubeCacheSize } from './geometryCache';
import { applyBundleOffset, bundleSlot } from './bundles';
import {
  connectorCableOffsetMm,
  connectorInsertionMm,
  connectorKindFor,
} from './connectors';
import { computeRoute, professionalSide } from '../routing';
import type { Vec3 } from '../anchors';
import type { RouteEndpoint } from '../routing';
import { rackGeometry } from '@/features/rack/rackMath';

const GEO = rackGeometry('open-frame-700');

const endpoint = (anchor: Vec3, out: 1 | -1 = 1): RouteEndpoint => ({
  surface: [anchor[0], anchor[1], anchor[2] - out * 0.022],
  anchor,
  exitDir: [0, 0, out],
});

/* ---- spline stage ----------------------------------------------------- */

describe('arc-fillet spline', () => {
  const OPTS = { minBendRadiusMm: 25, stiffness: 0.4 };

  it('stiffness widens the natural bend radius beyond the minimum', () => {
    expect(naturalBendRadiusM({ minBendRadiusMm: 25, stiffness: 0 })).toBeCloseTo(
      0.025,
      6,
    );
    expect(
      naturalBendRadiusM({ minBendRadiusMm: 25, stiffness: 0.8 }),
    ).toBeCloseTo(0.045, 6);
  });

  it('replaces a right-angle corner with an arc that stays clear of the knot', () => {
    const points: Vec3[] = [
      [0, 0, 0],
      [0.3, 0, 0],
      [0.3, 0.3, 0],
    ];
    const dense = filletPolyline(points, OPTS);
    // Denser than the input, endpoints preserved.
    expect(dense.length).toBeGreaterThan(4);
    expect(dense[0]).toEqual([0, 0, 0]);
    expect(dense[dense.length - 1]).toEqual([0.3, 0.3, 0]);
    // The filleted path never touches the sharp knee itself.
    const knee = dense.some(
      (p) => Math.hypot(p[0] - 0.3, p[1] - 0, p[2] - 0) < 0.005,
    );
    expect(knee).toBe(false);
    // Every arc sample keeps at least the natural radius from the knot's
    // inside corner center.
    const r = naturalBendRadiusM(OPTS);
    const center: Vec3 = [0.3 - r, r, 0];
    for (const p of dense) {
      const inCornerRegion =
        p[0] > 0.3 - r * 1.01 && p[1] < r * 1.01 && Math.abs(p[2]) < 1e-9;
      if (!inCornerRegion) continue;
      const d = Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
      expect(d).toBeGreaterThanOrEqual(r * 0.99);
      expect(d).toBeLessThanOrEqual(r * 1.01);
    }
  });

  it('merges collinear knots into one straight runway', () => {
    const points: Vec3[] = [
      [0, 0, 0],
      [0.1, 0, 0],
      [0.25, 0, 0],
    ];
    // Straight chains collapse to their endpoints — the interior knot
    // carries no bend and would only starve neighboring fillets.
    expect(filletPolyline(points, OPTS)).toEqual([
      [0, 0, 0],
      [0.25, 0, 0],
    ]);
  });

  it('shrinks the radius when segments are too short to host it', () => {
    const tight: Vec3[] = [
      [0, 0, 0],
      [0.02, 0, 0],
      [0.02, 0.02, 0],
    ];
    const dense = filletPolyline(tight, OPTS);
    // Still filleted (no knot pass-through), still bounded by segments.
    expect(dense.length).toBeGreaterThan(3);
    for (const p of dense) {
      expect(p[0]).toBeGreaterThanOrEqual(-1e-9);
      expect(p[0]).toBeLessThanOrEqual(0.02 + 1e-9);
      expect(p[1]).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('builds a smooth curve whose length tracks the polyline', () => {
    const points: Vec3[] = [
      [0, 0, 0],
      [0.3, 0, 0],
      [0.3, 0.3, 0],
    ];
    const curve = centerlineCurve(points, OPTS);
    const length = curve.getLength();
    // The fillet cuts the corner: shorter than the sharp polyline (0.6),
    // longer than the straight chord.
    expect(length).toBeLessThan(0.6);
    expect(length).toBeGreaterThan(Math.hypot(0.3, 0.3));
  });

  it('measures the sharpest turn for validation', () => {
    const right: Vec3[] = [
      [0, 0, 0],
      [0.1, 0, 0],
      [0.1, 0.1, 0],
    ];
    expect(maxTurnAngleDeg(right)).toBeCloseTo(90, 1);
    const hairpin: Vec3[] = [
      [0, 0, 0],
      [0.1, 0, 0],
      [0.005, 0.005, 0],
    ];
    expect(maxTurnAngleDeg(hairpin)).toBeGreaterThan(150);
  });
});

/* ---- geometry cache --------------------------------------------------- */

describe('tube geometry cache', () => {
  const OPTS = { minBendRadiusMm: 25, stiffness: 0.4 };
  const ROUTE: Vec3[] = [
    [0, 0, 0],
    [0.2, 0, 0],
    [0.2, 0.2, 0],
  ];

  it('shares identical routes and disposes on the last release', () => {
    const before = tubeCacheSize();
    const a = acquireTube(ROUTE, 0.003, 12, OPTS);
    const b = acquireTube(ROUTE, 0.003, 12, OPTS);
    expect(b.geometry).toBe(a.geometry);
    expect(tubeCacheSize()).toBe(before + 1);
    releaseTube(a.key);
    expect(tubeCacheSize()).toBe(before + 1); // still referenced
    releaseTube(b.key);
    expect(tubeCacheSize()).toBe(before);
  });

  it('distinguishes radius, quality and bend options', () => {
    const a = acquireTube(ROUTE, 0.003, 12, OPTS);
    const b = acquireTube(ROUTE, 0.004, 12, OPTS);
    const c = acquireTube(ROUTE, 0.003, 16, OPTS);
    expect(b.geometry).not.toBe(a.geometry);
    expect(c.geometry).not.toBe(a.geometry);
    releaseTube(a.key);
    releaseTube(b.key);
    releaseTube(c.key);
  });
});

/* ---- bundles ---------------------------------------------------------- */

describe('bundle looms', () => {
  it('packs slots hex-style: center, then rings of 6·ring', () => {
    expect(bundleSlot(0)).toEqual([0, 0]);
    for (let i = 1; i <= 6; i++) {
      const [x, y] = bundleSlot(i);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 6);
    }
    const [x7, y7] = bundleSlot(7);
    expect(Math.hypot(x7, y7)).toBeCloseTo(2, 6);
  });

  it('offsets only the core; ends stay on their ports', () => {
    const points: Vec3[] = [
      [0, 0, 0.4], // surface
      [0, 0, 0.42], // anchor
      [0, 0, 0.44], // exit
      [0.3, 0, 0.44], // core
      [0.3, 0.4, 0.44], // core
      [0.1, 0.4, 0.44], // exit
      [0.1, 0.4, 0.42], // anchor
      [0.1, 0.4, 0.4], // surface
    ];
    const offset = applyBundleOffset(points, 3, 4, [1, 0], 0.008);
    expect(offset[0]).toEqual(points[0]);
    expect(offset[2]).toEqual(points[2]);
    expect(offset[5]).toEqual(points[5]);
    expect(offset[7]).toEqual(points[7]);
    // Core points moved by exactly the spacing.
    const moved = Math.hypot(
      offset[3][0] - points[3][0],
      offset[3][1] - points[3][1],
      offset[3][2] - points[3][2],
    );
    expect(moved).toBeCloseTo(0.008, 6);
    // Same displacement for every core point (rigid loom).
    const moved4 = Math.hypot(
      offset[4][0] - points[4][0],
      offset[4][1] - points[4][1],
      offset[4][2] - points[4][2],
    );
    expect(moved4).toBeCloseTo(moved, 9);
  });

  it('slot 0 or degenerate cores change nothing', () => {
    const points: Vec3[] = [
      [0, 0, 0],
      [0.1, 0, 0],
    ];
    expect(applyBundleOffset(points, 1, 0, [1, 1], 0.01)).toBe(points);
    expect(applyBundleOffset(points, 0, 1, [0, 0], 0.01)).toBe(points);
  });
});

/* ---- professional routing --------------------------------------------- */

describe('professional routing', () => {
  const base = {
    slack: 'tight' as const,
    nominalLengthMm: 3000,
    minBendRadiusMm: 25,
    geometry: GEO,
  };

  it('runs the loom along the nearer side channel', () => {
    const src = endpoint([0.15, 0.2, 0.35]);
    const dst = endpoint([0.1, 0.6, 0.35]);
    expect(professionalSide(src, dst)).toBe(1);
    const route = computeRoute({
      ...base,
      source: src,
      destination: dst,
      mode: 'professional',
    });
    const maxX = Math.max(...route.points.map((p) => p[0]));
    expect(maxX).toBeGreaterThan(GEO.externalWidthM / 2);
    expect(route.bendRadiusOk).toBe(true);
  });

  it('squares the depth transition for opposite-face runs', () => {
    const route = computeRoute({
      ...base,
      source: endpoint([0.1, 0.2, 0.35]),
      destination: endpoint([0.1, 0.5, -0.35], -1),
      mode: 'professional',
    });
    // The side-channel run contains a point at the destination height
    // still on the source's depth plane (the squared corner). The slack
    // drape may bow beyond the channel, so compare against the true
    // channel coordinate, not max(x).
    const channelX = GEO.externalWidthM / 2 + 0.05;
    const corner = route.points.find(
      (p) => Math.abs(p[0] - channelX) < 1e-6 && Math.abs(p[2] - 0.372) < 0.02,
    );
    expect(corner).toBeDefined();
  });

  it('routes through the nearest cable manager in manager mode', () => {
    const managers: Vec3[] = [
      [0, 0.9, 0.35],
      [0, 0.31, 0.35],
    ];
    const route = computeRoute({
      ...base,
      source: endpoint([-0.1, 0.2, 0.35]),
      destination: endpoint([0.1, 0.4, 0.35]),
      mode: 'cable-manager',
      cableManagerPoints: managers,
    });
    // Midpoint Y is 0.3 → the 0.31 manager wins over the 0.9 one.
    expect(route.points.some((p) => Math.abs(p[1] - 0.31) < 1e-6)).toBe(true);
    expect(route.points.some((p) => Math.abs(p[1] - 0.9) < 1e-6)).toBe(false);
  });
});

/* ---- connector factory ------------------------------------------------ */

describe('connector factory', () => {
  it('chooses connectors from port type and cable category', () => {
    expect(connectorKindFor('rj45', 'copper')).toBe('rj45');
    expect(connectorKindFor('keystone', 'copper')).toBe('rj45');
    expect(connectorKindFor('sfp+', 'dac')).toBe('sfp');
    expect(connectorKindFor('sfp+', 'fiber')).toBe('sfp-fiber');
    expect(connectorKindFor('qsfp28', 'dac')).toBe('qsfp');
    expect(connectorKindFor('fiber-lc', 'fiber')).toBe('lc');
    expect(connectorKindFor('usb-c', 'peripheral')).toBe('usb-c');
    expect(connectorKindFor('hdmi', 'peripheral')).toBe('hdmi');
    expect(connectorKindFor('c14', 'power')).toBe('c13');
    expect(connectorKindFor('c20', 'power')).toBe('c19');
    expect(connectorKindFor('dc', 'power')).toBe('barrel');
    expect(connectorKindFor('serial', 'peripheral')).toBe('db9');
    expect(connectorKindFor('other', 'peripheral')).toBe('generic');
  });

  it('honors authored insertion depth and derives the sheath start', () => {
    expect(connectorInsertionMm('rj45', 'copper', undefined)).toBe(13);
    expect(connectorInsertionMm('rj45', 'copper', 10)).toBe(10);
    // RJ45: 21 body − 13 insertion + 0.85·16 boot = 21.6.
    expect(connectorCableOffsetMm('rj45', 'copper', undefined)).toBeCloseTo(
      21.6,
      1,
    );
    // Deeper insertion pulls the sheath start closer to the panel.
    expect(
      connectorCableOffsetMm('rj45', 'copper', 16),
    ).toBeLessThan(connectorCableOffsetMm('rj45', 'copper', 10));
  });
});
