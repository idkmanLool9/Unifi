import { describe, expect, it } from 'vitest';
import {
  arrayPorts,
  createPort,
  definitionWithPorts,
  DEFAULT_SNAP,
  detectPitchMm,
  metadataJson,
  nextPortId,
  portsFromDefinition,
  snapPosition,
  suggestPorts,
  toPortDefinition,
  type AuthoredPort,
} from './authoringModel';
import {
  primeCalibration,
  type DetectedConnector,
} from '@/features/devices/hardware/connectorCalibration';
import {
  portFace,
  resolveEndpoint,
} from '@/features/cables/anchors';
import { resolvePhysicalPorts } from '@/features/devices/hardware/physicalPorts';
import { validateDeviceDefinition } from '@/features/devices/deviceSchema';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import { rackGeometry } from '@/features/rack/rackMath';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;

const port = (over: Partial<AuthoredPort> = {}): AuthoredPort => ({
  id: 'rj45-1',
  type: 'rj45',
  location: 'front',
  positionMm: [0, 0, 100],
  rotationDeg: [0, 0, 0],
  sizeMm: [15, 13],
  poe: false,
  etherlighting: false,
  visible: true,
  anchorMm: [0, 0, 22],
  ...over,
});

describe('authoring model', () => {
  it('loads every resolved port of a definition', () => {
    primeCalibration(proMax.id, null);
    const ports = portsFromDefinition(proMax);
    expect(ports.length).toBe(resolvePhysicalPorts(proMax).length);
    expect(new Set(ports.map((p) => p.id)).size).toBe(ports.length);
    const first = ports.find((p) => p.id === 'gbe-top-1')!;
    expect(first.type).toBe('rj45');
    expect(first.anchorMm[2]).toBeCloseTo(22, 3);
  });

  it('generates unique ids per type', () => {
    const ports = [port({ id: 'rj45-1' }), port({ id: 'rj45-2' })];
    expect(nextPortId(ports, 'rj45')).toBe('rj45-3');
    expect(nextPortId(ports, 'sfp+')).toBe('sfp-1');
  });

  it('creates new ports on the faceplate center', () => {
    const p = createPort([], 'sfp+', proMax);
    expect(p.positionMm[2]).toBeCloseTo(proMax.depthMm / 2, 3);
    expect(p.sizeMm[0]).toBeGreaterThan(5);
  });

  it('serializes compactly: defaults are omitted', () => {
    const def = toPortDefinition(port());
    expect(def.count).toBe(1);
    expect(def.rotationDeg).toBeUndefined();
    expect(def.anchorMm).toBeUndefined();
    expect(def.sizeMm).toBeUndefined();
    expect(def.visible).toBeUndefined();

    const custom = toPortDefinition(
      port({ sizeMm: [10, 10], anchorMm: [1, 0, 30], visible: false }),
    );
    expect(custom.sizeMm).toEqual([10, 10]);
    expect(custom.anchorMm).toEqual([1, 0, 30]);
    expect(custom.visible).toBe(false);
  });

  it('round-trips through the schema validator and the port pipeline', () => {
    const ports = [
      port({ id: 'lan-1', positionMm: [-50, 0, 100], speedGbps: 2.5, poe: true }),
      port({ id: 'lan-2', positionMm: [-32, 0, 100], etherlighting: true }),
      port({ id: 'uplink-1', type: 'sfp+', positionMm: [40, 0, 100], sizeMm: [14, 9] }),
    ];
    const authored = definitionWithPorts(proMax, ports);
    expect(authored.portsAuthored).toBe(true);

    const parsed = validateDeviceDefinition(JSON.parse(metadataJson(authored)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const resolved = resolvePhysicalPorts(parsed.value);
    expect(resolved.map((p) => p.ref)).toEqual(['lan-1[1]', 'lan-2[1]', 'uplink-1[1]']);
    expect(resolved[0].positionMm).toEqual([-50, 0, 100]);
    expect(resolved[0].poe).toBe(true);
    expect(resolved[1].etherlighting).toBe(true);

    // Authored size drives the interaction bounds (no calibration here).
    primeCalibration(parsed.value.id, new Map());
    const face = portFace(parsed.value, resolved[2]);
    expect(face.widthMm).toBe(14);
    expect(face.heightMm).toBe(9);

    // And the cable endpoint resolves on the authored position.
    const geometry = rackGeometry('open-frame-700');
    const endpoint = resolveEndpoint(
      parsed.value,
      { startU: 1, facing: 'front' },
      geometry,
      'lan-1[1]',
    );
    expect(endpoint).not.toBeNull();
    primeCalibration(parsed.value.id, null);
  });

  it('adds a minimal lighting block when authored ports use Etherlighting', () => {
    const base = { ...proMax, lighting: undefined };
    const authored = definitionWithPorts(base, [port({ etherlighting: true })]);
    expect(authored.lighting?.etherlighting).toBe(true);
  });
});

describe('snapping', () => {
  const neighbours = [
    port({ id: 'a', positionMm: [0, 0, 100] }),
    port({ id: 'b', positionMm: [17.9, 0, 100] }),
  ];

  it('aligns to sibling center lines and pitch continuation', () => {
    const dragged = port({ id: 'c', positionMm: [35, 1.2, 100] });
    const snapped = snapPosition(dragged, [35, 1.2, 100], neighbours, DEFAULT_SNAP);
    expect(snapped[1]).toBe(0); // center-line magnet
    expect(snapped[0]).toBeCloseTo(35.8, 2); // one pitch right of 'b'
  });

  it('falls back to the mm grid when nothing is close', () => {
    const dragged = port({ id: 'c', positionMm: [80.27, 30.61, 100] });
    const snapped = snapPosition(dragged, [80.27, 30.61, 100], neighbours, DEFAULT_SNAP);
    expect(snapped[0]).toBe(80.5);
    expect(snapped[1]).toBe(30.5);
  });

  it('does nothing when disabled', () => {
    const dragged = port({ id: 'c' });
    expect(
      snapPosition(dragged, [1.23, 4.56, 100], neighbours, {
        ...DEFAULT_SNAP,
        enabled: false,
      }),
    ).toEqual([1.23, 4.56, 100]);
  });

  it('detects the dominant pitch for auto spacing', () => {
    const row = [0, 17.9, 35.8, 53.7].map((x, i) =>
      port({ id: `p${i}`, positionMm: [x, 0, 100] }),
    );
    expect(detectPitchMm(row, 'rj45')).toBeCloseTo(17.9, 2);
    expect(detectPitchMm([row[0]], 'rj45')).toBeNull();
  });
});

describe('array + suggestions', () => {
  it('arrays copies with unique ids along a direction', () => {
    const original = port({ id: 'rj45-1' });
    const copies = arrayPorts([original], original, 3, 18, '+x');
    expect(copies.map((c) => c.id)).toEqual(['rj45-2', 'rj45-3', 'rj45-4']);
    expect(copies.map((c) => c.positionMm[0])).toEqual([18, 36, 54]);
    const down = arrayPorts([original], original, 1, 14, '-y');
    expect(down[0].positionMm[1]).toBe(-14);
  });

  it('suggests slots from detected strips and singles, never auto-applied', () => {
    const detected: DetectedConnector[] = [
      {
        kind: 'strip',
        class: 'copper',
        location: 'front',
        centerMm: [0, -6, 140],
        sizeMm: [143.2, 12.5, 15],
        faceZMm: 147.5,
      },
      {
        kind: 'single',
        class: 'sfp',
        location: 'front',
        centerMm: [180, -6, 140],
        sizeMm: [14.9, 9.7, 48],
        faceZMm: 147.5,
      },
    ];
    const suggested = suggestPorts(proMax, detected);
    // 143.2mm / 17.9 catalog pitch → 8 slots + 1 SFP cage.
    expect(suggested.filter((p) => p.type === 'rj45').length).toBe(8);
    expect(suggested.filter((p) => p.type === 'sfp+').length).toBe(1);
    expect(new Set(suggested.map((p) => p.id)).size).toBe(9);
    const sfp = suggested.find((p) => p.type === 'sfp+')!;
    expect(sfp.positionMm[0]).toBeCloseTo(180, 3);
    expect(sfp.positionMm[2]).toBeCloseTo(147.5, 3);
  });
});
