import { describe, expect, it } from 'vitest';
import {
  poeBudgetW,
  portRef,
  portSummary,
  resolveLeds,
  resolvePhysicalPorts,
  resolvePowerConnectors,
  CONNECTOR_SIZES,
} from './physicalPorts';
import { defineDevice } from '../definitions/defineDevice';
import { GENERIC_DEVICES } from '../definitions/generic';
import type { DeviceSeed } from '../definitions/defineDevice';

const base: DeviceSeed = {
  id: 'hw-test',
  slug: 'hw-test',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'HW Test',
  modelNumber: 'HW-1',
  category: 'switching',
  rackUnits: 1,
  depthMm: 300,
  weightKg: 3,
  powerConsumptionWatts: 20,
  maximumPowerWatts: 30,
  description: 'test',
  presentation: { faceplate: 'network', tone: 'dark' },
};

describe('resolvePhysicalPorts', () => {
  it('expands groups into individually addressable ports with stable refs', () => {
    const device = defineDevice({
      ...base,
      ports: [
        {
          id: 'lan',
          type: 'rj45',
          count: 4,
          positionMm: [-50, 0, 150],
          pitchMm: 18,
          speedGbps: 1,
          poe: true,
        },
      ],
    });
    const ports = resolvePhysicalPorts(device);
    expect(ports).toHaveLength(4);
    expect(ports.map((p) => p.ref)).toEqual([
      'lan[1]',
      'lan[2]',
      'lan[3]',
      'lan[4]',
    ]);
    expect(ports[0].positionMm).toEqual([-50, 0, 150]);
    expect(ports[3].positionMm).toEqual([-50 + 3 * 18, 0, 150]);
    expect(ports.every((p) => p.poe && p.speedGbps === 1)).toBe(true);
    expect(portRef('lan', 2)).toBe('lan[2]');
  });

  it('auto-lays-out unpositioned groups across the faceplate without overlap', () => {
    const device = defineDevice({
      ...base,
      ports: [
        { id: 'a', type: 'rj45', count: 8 },
        { id: 'b', type: 'sfp+', count: 2 },
      ],
    });
    const ports = resolvePhysicalPorts(device);
    const a = ports.filter((p) => p.groupId === 'a');
    const b = ports.filter((p) => p.groupId === 'b');
    // Group b starts after group a ends (plus the group gap).
    const aRight = a[7].positionMm[0] + CONNECTOR_SIZES.rj45.widthMm / 2;
    const bLeft = b[0].positionMm[0] - CONNECTOR_SIZES['sfp+'].widthMm / 2;
    expect(bLeft).toBeGreaterThan(aRight);
    // Everything stays on the faceplate.
    expect(a[0].positionMm[2]).toBeCloseTo(device.depthMm / 2);
    for (const p of ports) {
      expect(Math.abs(p.positionMm[0])).toBeLessThan(device.widthMm / 2);
    }
  });

  it('separates rows into independent layout lanes', () => {
    const device = defineDevice({
      ...base,
      ports: [
        { id: 'top', type: 'sfp+', count: 4, row: 0 },
        { id: 'bottom', type: 'sfp+', count: 4, row: 1 },
      ],
    });
    const ports = resolvePhysicalPorts(device);
    const top = ports.filter((p) => p.groupId === 'top');
    const bottom = ports.filter((p) => p.groupId === 'bottom');
    // Same x start (independent lanes), mirrored y.
    expect(top[0].positionMm[0]).toBeCloseTo(bottom[0].positionMm[0]);
    expect(top[0].positionMm[1]).toBeGreaterThan(0);
    expect(bottom[0].positionMm[1]).toBeLessThan(0);
  });

  it('wraps oversized auto-laid groups onto the next row, never off-panel', () => {
    const device = defineDevice({
      ...base,
      ports: [{ id: 'big', type: 'rj45', count: 30 }],
    });
    const ports = resolvePhysicalPorts(device);
    expect(ports).toHaveLength(30);
    for (const p of ports) {
      expect(Math.abs(p.positionMm[0])).toBeLessThan(device.widthMm / 2);
    }
    // At least two distinct rows were used.
    expect(new Set(ports.map((p) => p.positionMm[1])).size).toBeGreaterThan(1);
  });

  it('places rear ports on the rear face with outward anchors', () => {
    const device = defineDevice({
      ...base,
      ports: [{ id: 'rear-lan', type: 'rj45', count: 1, location: 'rear' }],
    });
    const [port] = resolvePhysicalPorts(device);
    expect(port.positionMm[2]).toBeCloseTo(-device.depthMm / 2);
    expect(port.anchorMm[2]).toBeLessThan(port.positionMm[2]);
  });

  it('keeps hidden ports addressable but flagged invisible', () => {
    const device = defineDevice({
      ...base,
      ports: [{ id: 'internal', type: 'usb-a', count: 1, visible: false }],
    });
    const [port] = resolvePhysicalPorts(device);
    expect(port.visible).toBe(false);
    expect(port.ref).toBe('internal[1]');
  });
});

describe('resolvePowerConnectors', () => {
  it('resolves inlets on the rear panel with stable refs', () => {
    const device = defineDevice({
      ...base,
      power: {
        connectors: [{ id: 'psu', type: 'c14', count: 2, location: 'rear' }],
        redundant: true,
      },
    });
    const inlets = resolvePowerConnectors(device);
    expect(inlets).toHaveLength(2);
    expect(inlets.map((p) => p.ref)).toEqual(['psu[1]', 'psu[2]']);
    expect(inlets[0].positionMm[2]).toBeCloseTo(-device.depthMm / 2);
    expect(inlets[0].positionMm[0]).not.toBeCloseTo(inlets[1].positionMm[0]);
  });
});

describe('LED resolution', () => {
  it('applies kind-based colors and defaults', () => {
    const device = defineDevice({
      ...base,
      leds: [
        { id: 'pwr', label: 'Power', kind: 'power' },
        { id: 'fault', label: 'Fault', kind: 'fault', diameterMm: 3, state: 'off' },
      ],
    });
    const leds = resolveLeds(device);
    expect(leds[0].color).toBe('#3fb970');
    expect(leds[0].on).toBe(true);
    expect(leds[0].diameterMm).toBe(2);
    expect(leds[1].color).toBe('#e5544b');
    expect(leds[1].on).toBe(false);
    expect(leds[1].diameterMm).toBe(3);
  });
});

describe('patch panel generation', () => {
  it('exposes every keystone opening as an addressable connector', () => {
    const panel24 = GENERIC_DEVICES.find((d) => d.id === 'gen-patch-24')!;
    const ports = resolvePhysicalPorts(panel24);
    expect(ports).toHaveLength(24);
    expect(ports[0].ref).toBe('keystone[1]');
    expect(ports[23].ref).toBe('keystone[24]');
    // Openings stay inside the faceplate.
    for (const p of ports) {
      expect(Math.abs(p.positionMm[0])).toBeLessThan(panel24.widthMm / 2);
    }
  });

  it('generates both rows of the 48-port panel', () => {
    const panel48 = GENERIC_DEVICES.find((d) => d.id === 'gen-patch-48')!;
    const ports = resolvePhysicalPorts(panel48);
    expect(ports).toHaveLength(48);
    expect(ports.filter((p) => p.positionMm[1] > 0)).toHaveLength(24);
    expect(ports.filter((p) => p.positionMm[1] < 0)).toHaveLength(24);
  });

  it('blank and brush panels expose no connectors', () => {
    const blank = GENERIC_DEVICES.find((d) => d.id === 'gen-blank-1u')!;
    expect(resolvePhysicalPorts(blank)).toHaveLength(0);
  });
});

describe('summaries', () => {
  it('groups the port summary by connector type', () => {
    const device = defineDevice({
      ...base,
      ports: [
        { id: 'a', type: 'rj45', count: 16 },
        { id: 'b', type: 'rj45', count: 8 },
        { id: 'c', type: 'sfp+', count: 2 },
      ],
    });
    expect(portSummary(device)).toEqual([
      { type: 'rj45', count: 24 },
      { type: 'sfp+', count: 2 },
    ]);
  });

  it('reads the PoE budget from power metadata or group sums', () => {
    const explicit = defineDevice({
      ...base,
      power: { connectors: [], poeBudgetW: 400 },
    });
    expect(poeBudgetW(explicit)).toBe(400);

    const summed = defineDevice({
      ...base,
      ports: [
        { id: 'a', type: 'rj45', count: 8, poe: true, poeBudgetW: 120 },
        { id: 'b', type: 'rj45', count: 8, poe: true, poeBudgetW: 60 },
      ],
    });
    expect(poeBudgetW(summed)).toBe(180);
    expect(poeBudgetW(defineDevice(base))).toBeNull();
  });
});

describe('etherlighting metadata (Pro Max)', () => {
  it('flags every copper port and none of the SFP cages', async () => {
    const { UBIQUITI_DEVICES } = await import('../definitions/ubiquiti');
    const proMax = UBIQUITI_DEVICES.find(
      (d) => d.id === 'ubnt-usw-pro-max-24-poe',
    )!;
    const ports = resolvePhysicalPorts(proMax);
    const lit = ports.filter((p) => p.etherlighting);
    expect(lit).toHaveLength(24);
    expect(ports.filter((p) => p.type === 'sfp+').every((p) => !p.etherlighting)).toBe(true);
    // Two physical rows.
    expect(new Set(lit.map((p) => p.positionMm[1])).size).toBe(2);
  });
});
