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

  it('parses extended port metadata (speed, PoE, Etherlighting, pitch)', () => {
    const result = validateDeviceDefinition({
      ...VALID_INPUT,
      ports: [
        {
          id: 'gbe',
          type: 'rj45',
          count: 16,
          pitchMm: 17.9,
          speedGbps: 1,
          poe: true,
          etherlighting: true,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ports[0]).toMatchObject({
      speedGbps: 1,
      poe: true,
      etherlighting: true,
      pitchMm: 17.9,
    });
  });

  it('parses lighting capabilities with defaults and rejects bad shapes', () => {
    const ok = validateDeviceDefinition({
      ...VALID_INPUT,
      lighting: {
        etherlighting: true,
        perPortLink: true,
        poeIndicator: true,
        speedColors: { '1g': '#9aa3ad', '10g': '#7c5cff' },
        statusLed: { color: '#4c82f7', positionMm: [205, 8, 162.5] },
        effects: ['breathe'],
      },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.lighting?.etherlighting).toBe(true);
      expect(ok.value.lighting?.speedColors['10g']).toBe('#7c5cff');
      expect(ok.value.lighting?.statusLed?.positionMm).toEqual([205, 8, 162.5]);
    }

    // Omitted lighting stays undefined (no capabilities claimed).
    const none = validateDeviceDefinition(VALID_INPUT);
    expect(none.ok && none.value.lighting).toBeUndefined();

    const bad = validateDeviceDefinition({
      ...VALID_INPUT,
      lighting: { speedColors: { '1g': 42 }, effects: 'rainbow' },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const paths = bad.issues.map((i) => i.path);
      expect(paths).toContain('lighting.speedColors');
      expect(paths).toContain('lighting.effects');
    }
  });

  it('accepts per-axis scale and rejects malformed axis scales', () => {
    const ok = validateDeviceDefinition({
      ...VALID_INPUT,
      modelTransform: { scale: [0.001, 0.001, 0.002] },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.modelTransform.scale).toEqual([0.001, 0.001, 0.002]);

    for (const bad of [[1, 1], [1, 0, 1], ['1', 1, 1]]) {
      const result = validateDeviceDefinition({
        ...VALID_INPUT,
        modelTransform: { scale: bad },
      });
      expect(result.ok).toBe(false);
    }
  });
});
