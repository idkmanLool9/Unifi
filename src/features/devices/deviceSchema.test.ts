import { describe, expect, it } from 'vitest';
import { validateDeviceDefinition } from './deviceSchema';

const VALID_INPUT = {
  id: 'test-switch',
  slug: 'test-switch',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'Test Switch 24',
  modelNumber: 'TS-24',
  category: 'switching',
  rackUnits: 1,
  widthMm: 442,
  heightMm: 43.7,
  depthMm: 300,
  weightKg: 4.2,
  powerConsumptionWatts: 30,
  maximumPowerWatts: 60,
  description: 'A test switch.',
};

describe('validateDeviceDefinition', () => {
  it('accepts a minimal valid definition and applies defaults', () => {
    const result = validateDeviceDefinition(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mountingStandard).toBe('eia-310');
    expect(result.value.defaultFacing).toBe('front');
    expect(result.value.modelTransform).toEqual({
      scale: 1,
      rotationDeg: [0, 0, 0],
      offsetMm: [0, 0, 0],
    });
    expect(result.value.mountingOffsetMm).toBe(0);
    expect(result.value.tags).toEqual([]);
    expect(result.value.ports).toEqual([]);
    expect(result.value.presentation.faceplate).toBe('server');
  });

  it('parses ports and model transforms', () => {
    const result = validateDeviceDefinition({
      ...VALID_INPUT,
      modelTransform: { scale: 0.5, rotationDeg: [0, 90, 0] },
      ports: [{ id: 'lan', type: 'rj45', count: 24, label: 'LAN' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.modelTransform.scale).toBe(0.5);
    expect(result.value.modelTransform.rotationDeg).toEqual([0, 90, 0]);
    expect(result.value.modelTransform.offsetMm).toEqual([0, 0, 0]);
    expect(result.value.ports).toHaveLength(1);
    expect(result.value.ports[0].count).toBe(24);
  });

  it('rejects non-object input', () => {
    const result = validateDeviceDefinition('nope');
    expect(result.ok).toBe(false);
  });

  it('reports each missing or invalid field with its path', () => {
    const result = validateDeviceDefinition({
      ...VALID_INPUT,
      id: '',
      rackUnits: 2.5,
      depthMm: -10,
      category: 'toaster',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('id');
    expect(paths).toContain('rackUnits');
    expect(paths).toContain('depthMm');
    expect(paths).toContain('category');
  });

  it('rejects invalid port entries without dropping the whole definition shape', () => {
    const result = validateDeviceDefinition({
      ...VALID_INPUT,
      ports: [{ id: 'bad', type: 'laser', count: 0 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.path.startsWith('ports[0]'))).toBe(
      true,
    );
  });

  it('rejects a non-positive model scale', () => {
    const result = validateDeviceDefinition({
      ...VALID_INPUT,
      modelTransform: { scale: 0 },
    });
    expect(result.ok).toBe(false);
  });
});
