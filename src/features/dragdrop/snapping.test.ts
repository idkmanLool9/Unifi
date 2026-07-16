import { describe, expect, it } from 'vitest';
import {
  chooseSlot,
  maxStartU,
  pointerStartU,
  snapStartU,
  SNAP_HYSTERESIS_U,
} from './snapping';
import { U_METERS } from '@/features/rack/rackConstants';
import type { PlacedDevice, PlacementContext } from '@/features/rack/rackMath';
import { defineDevice } from '@/features/devices/definitions/defineDevice';

const RAIL_BASE = 0.1;
const yAtU = (uFloat: number) => RAIL_BASE + (uFloat - 1) * U_METERS;

const oneU = defineDevice({
  id: 'snap-1u',
  slug: 'snap-1u',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'Snap 1U',
  modelNumber: 'S1',
  category: 'switching',
  rackUnits: 1,
  depthMm: 300,
  weightKg: 3,
  powerConsumptionWatts: 20,
  maximumPowerWatts: 30,
  description: 'test',
  presentation: { faceplate: 'network', tone: 'dark' },
});

const twoU = defineDevice({ ...oneU, id: 'snap-2u', slug: 'snap-2u', rackUnits: 2 });

const DEFS = new Map([oneU, twoU].map((d) => [d.id, d]));

function ctx(
  instances: PlacedDevice[] = [],
  rackUnits = 9,
  usableDepthMm = 700,
): PlacementContext {
  return {
    rackUnits: rackUnits as PlacementContext['rackUnits'],
    usableDepthMm,
    shelfAvailable: true,
    instances,
    getDefinition: (id) => DEFS.get(id),
  };
}

const instance = (id: string, definitionId: string, startU: number): PlacedDevice =>
  ({ id, definitionId, startU, facing: 'front', visible: true });

describe('pointerStartU', () => {
  it('maps a pointer inside a unit to that unit for 1U devices', () => {
    expect(pointerStartU(yAtU(1.5), 1, 9, RAIL_BASE)).toBe(1);
    expect(pointerStartU(yAtU(4.5), 1, 9, RAIL_BASE)).toBe(4);
    expect(pointerStartU(yAtU(9.4), 1, 9, RAIL_BASE)).toBe(9);
  });

  it('centers multi-U devices on the pointer', () => {
    // Pointer at the U4/U5 boundary: a 2U device spans U4–U5 exactly.
    expect(pointerStartU(yAtU(5.0), 2, 9, RAIL_BASE)).toBe(4);
    expect(pointerStartU(yAtU(5.6), 2, 9, RAIL_BASE)).toBe(5);
  });

  it('clamps to the rack bounds for every size', () => {
    expect(pointerStartU(yAtU(-3), 1, 9, RAIL_BASE)).toBe(1);
    expect(pointerStartU(yAtU(30), 1, 9, RAIL_BASE)).toBe(9);
    expect(pointerStartU(yAtU(30), 2, 9, RAIL_BASE)).toBe(8);
    expect(maxStartU(2, 9)).toBe(8);
  });
});

describe('snapStartU hysteresis', () => {
  it('keeps the held slot while jittering on a boundary', () => {
    // Sit just below the U4/U5 boundary, then jitter across it by less
    // than the hysteresis margin: the preview must not flicker.
    let held = snapStartU(yAtU(4.9), null, 1, 9, RAIL_BASE);
    expect(held).toBe(4);
    for (const uFloat of [5.05, 4.95, 5.1, 4.9, 5.12]) {
      held = snapStartU(yAtU(uFloat), held, 1, 9, RAIL_BASE);
      expect(held).toBe(4);
    }
  });

  it('switches once the pointer clearly enters the next unit', () => {
    let held = snapStartU(yAtU(4.5), null, 1, 9, RAIL_BASE);
    held = snapStartU(yAtU(5.5 + SNAP_HYSTERESIS_U), held, 1, 9, RAIL_BASE);
    expect(held).toBe(5);
  });

  it('follows fast pointer jumps immediately', () => {
    const held = snapStartU(yAtU(8.5), 2, 1, 9, RAIL_BASE);
    expect(held).toBe(8);
  });

  it('is stable for multi-U devices too', () => {
    let held = snapStartU(yAtU(5.0), null, 2, 9, RAIL_BASE); // U4–U5
    expect(held).toBe(4);
    held = snapStartU(yAtU(5.3), held, 2, 9, RAIL_BASE); // inside margin
    expect(held).toBe(4);
    held = snapStartU(yAtU(6.2), held, 2, 9, RAIL_BASE); // clearly past
    expect(held).toBe(5);
  });
});

describe('chooseSlot', () => {
  it('returns the pointer slot when it is valid', () => {
    const { startU, validation } = chooseSlot(3, oneU, ctx());
    expect(startU).toBe(3);
    expect(validation.ok).toBe(true);
  });

  it('prefers the nearest valid slot around an occupied one', () => {
    const occupied = ctx([instance('a', 'snap-1u', 3)]);
    const { startU, validation } = chooseSlot(3, oneU, occupied);
    expect([2, 4]).toContain(startU);
    expect(validation.ok).toBe(true);
  });

  it('reports the honest failure when nothing nearby is free', () => {
    const packed = ctx([
      instance('a', 'snap-1u', 1),
      instance('b', 'snap-1u', 2),
      instance('c', 'snap-1u', 3),
      instance('d', 'snap-1u', 4),
      instance('e', 'snap-1u', 5),
    ]);
    const { startU, validation } = chooseSlot(3, oneU, packed);
    expect(startU).toBe(3);
    expect(validation).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('Shift (precise) never redirects away from the pointer slot', () => {
    const occupied = ctx([instance('a', 'snap-1u', 3)]);
    const { startU, validation } = chooseSlot(3, oneU, occupied, {
      precise: true,
    });
    expect(startU).toBe(3);
    expect(validation).toMatchObject({ ok: false, reason: 'occupied' });
  });

  it('ignores the moving instance itself', () => {
    const moving = ctx([instance('a', 'snap-2u', 3)]);
    const { validation } = chooseSlot(4, twoU, moving, {
      ignoreInstanceId: 'a',
    });
    expect(validation.ok).toBe(true);
  });

  it('propagates depth failures instead of hiding them', () => {
    const shallow = ctx([], 9, 250);
    const { validation } = chooseSlot(3, oneU, shallow);
    expect(validation).toMatchObject({ ok: false, reason: 'too-deep' });
  });
});
