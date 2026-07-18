import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, MathUtils, Mesh } from 'three';
import {
  calibratePorts,
  detectConnectors,
  meshBoundsLocal,
  primeCalibration,
  type MeshBoundsMm,
} from './connectorCalibration';
import { portFace, resolveEndpoint } from '@/features/cables/anchors';
import { UBIQUITI_DEVICES } from '../definitions/ubiquiti';
import { rackGeometry } from '@/features/rack/rackMath';

const proMax = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-usw-pro-max-24-poe')!;

/**
 * Real mesh bounds dumped from the Pro Max 24 PoE GLB (raw model space
 * + the auto import transform y −21.85 / z +1.09 applied): three 8-port
 * RJ45 bank strips in one row and two side-by-side SFP+ cages.
 */
const bounds = (
  name: string,
  c: [number, number, number],
  s: [number, number, number],
): MeshBoundsMm => ({
  name,
  centerMm: [c[0], c[1] - 21.85, c[2] + 1.09],
  sizeMm: s,
});

const PRO_MAX_BOUNDS: MeshBoundsMm[] = [
  bounds('case_front', [0, 21.9, 156.3], [442.4, 43.7, 12.5]),
  bounds('case_top', [0, 21.8, -6.3], [442.4, 43.7, 312.5]),
  bounds('holes', [0, 21.8, 132.5], [440, 30.9, 30.9]),
  bounds('LCM', [-204.4, 21.8, 162.0], [23, 23, 0.7]),
  // RJ45 bank strips: plastic bodies + narrower companion meshes.
  bounds('platic_1', [107.6, 15.8, 154.5], [114.5, 12.5, 15.3]),
  bounds('backs', [107.6, 16.7, 151.5], [112.6, 9.5, 1.8]),
  bounds('platic_1.001', [-9.6, 15.8, 154.5], [114.5, 12.5, 15.3]),
  bounds('backs.001', [-9.6, 16.7, 151.5], [112.6, 9.5, 1.8]),
  bounds('platic_1.002', [-126.9, 15.8, 154.5], [114.5, 12.5, 15.3]),
  bounds('backs.002', [-126.9, 16.7, 151.5], [112.6, 9.5, 1.8]),
  // Two SFP+ cages, side by side.
  bounds('sfp', [192.4, 14.0, 138.3], [14.9, 9.7, 48.7]),
  bounds('sfp.001', [176.4, 14.0, 138.3], [14.9, 9.7, 48.7]),
  // Rear power module bits (should not be treated as data connectors).
  bounds('black', [-177.1, 19.0, -149.9], [45.5, 28.0, 25.2]),
  bounds('pins', [-171.3, 19.0, -143.2], [16.0, 8.0, 18.6]),
];

afterEach(() => primeCalibration(proMax.id, null));

describe('meshBoundsLocal yaw handling', () => {
  /** 20×10×10 mm box centered at (50, 0, 30) mm in raw model space. */
  const model = () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(0.02, 0.01, 0.01));
    mesh.position.set(0.05, 0, 0.03);
    root.add(mesh);
    return root;
  };
  const transform = (yawDeg: number) => ({
    scale: 1,
    rotationDeg: [0, yawDeg, 0] as [number, number, number],
    offsetMm: [0, 0, 0] as [number, number, number],
  });
  /** Ground truth: the render rotates the mesh center by Ry(yaw). */
  const rendered = (yawDeg: number): [number, number] => {
    const t = MathUtils.degToRad(yawDeg);
    return [
      50 * Math.cos(t) + 30 * Math.sin(t),
      -50 * Math.sin(t) + 30 * Math.cos(t),
    ];
  };

  it.each([90, -90, 180, 0])(
    'matches the rendered transform for a %d° yaw',
    (yawDeg) => {
      const [bounds] = meshBoundsLocal(model(), transform(yawDeg));
      const [ex, ez] = rendered(yawDeg);
      expect(bounds.centerMm[0]).toBeCloseTo(ex, 4);
      expect(bounds.centerMm[1]).toBeCloseTo(0, 4);
      expect(bounds.centerMm[2]).toBeCloseTo(ez, 4);
      // Odd quarter turns swap the horizontal extents.
      const swapped = Math.abs(yawDeg) === 90;
      expect(bounds.sizeMm[0]).toBeCloseTo(swapped ? 10 : 20, 4);
      expect(bounds.sizeMm[2]).toBeCloseTo(swapped ? 20 : 10, 4);
    },
  );
});

describe('connector detection', () => {
  it('finds the three RJ45 bank strips and both SFP cages', () => {
    const detected = detectConnectors(PRO_MAX_BOUNDS, proMax);
    const strips = detected.filter((c) => c.kind === 'strip' && c.location === 'front');
    const sfps = detected.filter((c) => c.class === 'sfp' && c.location === 'front');
    expect(strips).toHaveLength(3);
    expect(sfps).toHaveLength(2);
    // Chassis, faceplate and the LCM display are never connectors.
    expect(detected.some((c) => Math.abs(c.centerMm[0] + 204.4) < 1)).toBe(false);
  });

  it('merges stacked bank meshes into one strip per bank', () => {
    const detected = detectConnectors(PRO_MAX_BOUNDS, proMax);
    const xs = detected
      .filter((c) => c.kind === 'strip')
      .map((c) => Math.round(c.centerMm[0]))
      .sort((a, b) => a - b);
    expect(xs).toEqual([-127, -10, 108]);
  });
});

describe('metadata alignment', () => {
  it('distributes 24 copper ports across the strips and snaps SFPs 1:1', () => {
    const detected = detectConnectors(PRO_MAX_BOUNDS, proMax);
    const calibrated = calibratePorts(proMax, detected);

    // All 24 copper + 2 SFP ports calibrated.
    expect(calibrated.size).toBe(26);

    // Copper ports live in ONE physical row at the strips' y.
    const copperY = new Set(
      [...calibrated.entries()]
        .filter(([ref]) => ref.startsWith('gbe') || ref.startsWith('2p5'))
        .map(([, p]) => Math.round(p.positionMm[1] * 10) / 10),
    );
    expect(copperY.size).toBe(1);
    expect([...copperY][0]).toBeCloseTo(15.8 - 21.85, 1);

    // First copper port sits inside the leftmost strip.
    const first = calibrated.get('gbe-top[1]')!;
    expect(first.positionMm[0]).toBeGreaterThan(-126.9 - 114.5 / 2);
    expect(first.positionMm[0]).toBeLessThan(-126.9);

    // SFPs snap exactly onto the two cage meshes.
    const sfp1 = calibrated.get('sfp[1]')!;
    const sfp2 = calibrated.get('sfp[2]')!;
    expect(sfp1.positionMm[0]).toBeCloseTo(176.4, 1);
    expect(sfp2.positionMm[0]).toBeCloseTo(192.4, 1);
    expect(sfp1.widthMm).toBeCloseTo(14.9, 1);
  });

  it('keeps metadata untouched when capacity does not match', () => {
    // Only one strip detected: 8 slots for 24 copper ports -> fallback.
    const partial = detectConnectors(
      PRO_MAX_BOUNDS.filter(
        (b) => !b.name.startsWith('platic_1.') && !b.name.startsWith('backs.'),
      ),
      proMax,
    );
    const calibrated = calibratePorts(proMax, partial);
    expect([...calibrated.keys()].some((ref) => ref.startsWith('gbe'))).toBe(false);
    // SFPs still calibrate (their class matches independently).
    expect(calibrated.has('sfp[1]')).toBe(true);
  });
});

describe('calibration overlay in anchors', () => {
  const GEO = rackGeometry('open-frame-700');
  const instance = { startU: 1, facing: 'front' as const };

  it('resolveEndpoint and portFace use calibrated geometry when cached', () => {
    const detected = detectConnectors(PRO_MAX_BOUNDS, proMax);
    primeCalibration(proMax.id, calibratePorts(proMax, detected));

    const endpoint = resolveEndpoint(proMax, instance, GEO, 'sfp[1]')!;
    // x snapped to the real cage; metadata said x = 86.
    const localX = endpoint.surface[0];
    expect(localX).toBeCloseTo(0.1764, 3);

    const face = portFace(proMax, endpoint.port);
    expect(face.widthMm).toBeCloseTo(14.9, 1);
  });

  it('falls back to metadata without calibration', () => {
    const endpoint = resolveEndpoint(proMax, instance, GEO, 'sfp[1]')!;
    expect(endpoint.surface[0]).toBeCloseTo(0.086, 3);
  });
});
