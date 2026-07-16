import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import {
  buildImportReport,
  checkDimensions,
  classifyOrigin,
  defaultTransform,
  detectQuarterTurn,
  measureObjectMm,
  resolveTransform,
  transformedSizeMm,
  type MeasuredBoundsMm,
} from './modelImport';
import { defineDevice } from '../definitions/defineDevice';

/** A chassis-like mesh, sized in mm, positioned in mm. */
function chassis(
  sizeMm: [number, number, number],
  positionMm: [number, number, number] = [0, 0, 0],
): Group {
  const mesh = new Mesh(
    new BoxGeometry(sizeMm[0] / 1000, sizeMm[1] / 1000, sizeMm[2] / 1000),
  );
  mesh.position.set(
    positionMm[0] / 1000,
    positionMm[1] / 1000,
    positionMm[2] / 1000,
  );
  const group = new Group();
  group.add(mesh);
  return group;
}

function bounds(
  size: [number, number, number],
  center: [number, number, number] = [0, 0, 0],
): MeasuredBoundsMm {
  return {
    size,
    center,
    min: [0, 1, 2].map((i) => center[i] - size[i] / 2) as [number, number, number],
    max: [0, 1, 2].map((i) => center[i] + size[i] / 2) as [number, number, number],
  };
}

const spec = defineDevice({
  id: 'test-switch',
  slug: 'test-switch',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'Test Switch',
  modelNumber: 'TS-1',
  category: 'switching',
  rackUnits: 1,
  widthMm: 442,
  heightMm: 44,
  depthMm: 325,
  weightKg: 4,
  powerConsumptionWatts: 30,
  maximumPowerWatts: 60,
  description: 'test',
  presentation: { faceplate: 'network', tone: 'dark' },
});

describe('measureObjectMm', () => {
  it('measures nested geometry in local space, in millimeters', () => {
    const model = chassis([442, 44, 325], [0, 22, 0]); // base origin
    const measured = measureObjectMm(model)!;
    expect(measured.size[0]).toBeCloseTo(442, 3);
    expect(measured.size[1]).toBeCloseTo(44, 3);
    expect(measured.size[2]).toBeCloseTo(325, 3);
    expect(measured.min[1]).toBeCloseTo(0, 3);
    expect(measured.center[1]).toBeCloseTo(22, 3);
  });

  it('returns null for a model without geometry', () => {
    expect(measureObjectMm(new Group())).toBeNull();
  });
});

describe('classifyOrigin', () => {
  it('recognizes a centered model', () => {
    expect(classifyOrigin(bounds([442, 44, 325]))).toBe('centered');
  });

  it('recognizes a base-origin model despite small horizontal noise', () => {
    expect(classifyOrigin(bounds([442, 44, 325], [0, 22, -1.1]))).toBe('base');
  });

  it('flags anything else as offset', () => {
    expect(classifyOrigin(bounds([442, 44, 325], [100, 60, 40]))).toBe('offset');
  });
});

describe('forward-axis detection', () => {
  it('keeps a correctly authored model as-is', () => {
    expect(detectQuarterTurn(bounds([442, 44, 325]), spec)).toBe(false);
  });

  it('detects width authored along Z', () => {
    expect(detectQuarterTurn(bounds([325, 44, 442]), spec)).toBe(true);
  });

  it('keeps square footprints as authored (tie)', () => {
    const square = defineDevice({ ...spec, id: 't2', depthMm: 442 });
    expect(detectQuarterTurn(bounds([442, 44, 442]), square)).toBe(false);
  });
});

describe('defaultTransform', () => {
  it('normalizes a base-origin model with a pure vertical drop', () => {
    const { transform, quarterTurn } = defaultTransform(
      bounds([442, 44, 325], [0, 22, 0]),
      spec,
    );
    expect(quarterTurn).toBe(false);
    expect(transform.rotationDeg).toEqual([0, 0, 0]);
    expect(transform.offsetMm).toEqual([0, -22, 0]);
    expect(transform.scale).toBe(1);
  });

  it('rotates a sideways model and re-centers the rotated bounds', () => {
    // Width along Z, base origin, nose 10mm toward +X.
    const { transform, quarterTurn } = defaultTransform(
      bounds([325, 44, 442], [10, 22, 0]),
      spec,
    );
    expect(quarterTurn).toBe(true);
    expect(transform.rotationDeg).toEqual([0, -90, 0]);
    // Yaw -90 maps (x, z) -> (-z, x): center [10,22,0] -> [0,22,10].
    expect(transform.offsetMm).toEqual([0, -22, -10]);
  });

  it('is deterministic: the same bounds always produce the same transform', () => {
    const b = bounds([325.3, 43.71, 442.42], [1.23, 21.9, -0.55]);
    expect(defaultTransform(b, spec)).toEqual(defaultTransform(b, spec));
  });
});

describe('resolveTransform', () => {
  it('lets explicit metadata win verbatim', () => {
    const explicit = defineDevice({
      ...spec,
      id: 't3',
      modelTransform: { rotationDeg: [0, 180, 0], offsetMm: [0, -21.85, 0] },
    });
    const resolved = resolveTransform(explicit, bounds([442, 44, 325]));
    expect(resolved.source).toBe('metadata');
    expect(resolved.transform.rotationDeg).toEqual([0, 180, 0]);
  });

  it('derives the default when metadata is silent', () => {
    const resolved = resolveTransform(spec, bounds([442, 44, 325], [0, 22, 0]));
    expect(resolved.source).toBe('auto');
    expect(resolved.transform.offsetMm).toEqual([0, -22, 0]);
  });
});

describe('dimension validation', () => {
  it('reports sub-tolerance deviation without warning', () => {
    // The milestone's example: expected 442.4, measured 441.7 -> 0.16%.
    const checks = checkDimensions(
      [441.7, 44, 325],
      { widthMm: 442.4, heightMm: 44, depthMm: 325 },
    );
    expect(checks[0].deviationPct).toBeCloseTo(-0.16, 2);
    expect(checks[0].withinTolerance).toBe(true);
  });

  it('flags deviations beyond tolerance', () => {
    const checks = checkDimensions(
      [442, 44, 280],
      { widthMm: 442, heightMm: 44, depthMm: 325 },
    );
    const depth = checks.find((c) => c.axis === 'depth')!;
    expect(depth.withinTolerance).toBe(false);
    expect(depth.deviationPct).toBeCloseTo(-13.85, 1);
  });

  it('accounts for the transform when sizing rotated models', () => {
    const size = transformedSizeMm(bounds([325, 44, 442]), {
      scale: 1,
      rotationDeg: [0, -90, 0],
      offsetMm: [0, 0, 0],
    });
    expect(size).toEqual([442, 44, 325]);
  });
});

describe('buildImportReport (end to end)', () => {
  it('produces a clean report for an in-spec auto-imported model', () => {
    const report = buildImportReport(
      spec,
      chassis([442, 43.7, 327.6], [0, 21.85, -1.1]),
    )!;
    expect(report.transformSource).toBe('auto');
    expect(report.origin).toBe('base');
    expect(report.quarterTurn).toBe(false);
    expect(report.transform.offsetMm[1]).toBeCloseTo(-21.85, 1);
    expect(report.warnings).toEqual([]);
    expect(report.finalSizeMm[0]).toBeCloseTo(442, 1);
  });

  it('warns on out-of-spec models and never rescales them', () => {
    const report = buildImportReport(spec, chassis([442, 44, 250]))!;
    expect(report.transform.scale).toBe(1);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain('depth');
  });

  it('returns null for geometry-free scenes', () => {
    expect(buildImportReport(spec, new Group())).toBeNull();
  });
});
