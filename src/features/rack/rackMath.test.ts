import { describe, expect, it } from 'vitest';
import {
  buildOccupancy,
  devicePlacement,
  findFirstFreeSlot,
  frontRailPlaneZ,
  maxOccupiedU,
  occupiedUnits,
  uSlotY,
  usableDepthMm,
  validatePlacement,
  type PlacedDevice,
  type PlacementContext,
} from './rackMath';
import { railBaseY, U_METERS } from './rackConstants';
import { defineDevice } from '@/features/devices/definitions/defineDevice';

const oneU = defineDevice({
  id: 'test-1u',
  slug: 'test-1u',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'Test 1U',
  modelNumber: 'T1',
  category: 'switching',
  rackUnits: 1,
  depthMm: 300,
  weightKg: 3,
  powerConsumptionWatts: 20,
  maximumPowerWatts: 30,
  description: 'test',
  presentation: { faceplate: 'network', tone: 'dark' },
});

const twoU = defineDevice({
  ...oneU,
  id: 'test-2u',
  slug: 'test-2u',
  productName: 'Test 2U',
  rackUnits: 2,
});

const tooDeep = defineDevice({
  ...oneU,
  id: 'test-deep',
  slug: 'test-deep',
  productName: 'Test Deep',
  depthMm: 900,
});

const shelfMount = defineDevice({
  ...oneU,
  id: 'test-shelf',
  slug: 'test-shelf',
  productName: 'Test Shelf',
  mountingStandard: 'none',
});

const DEFS = new Map(
  [oneU, twoU, tooDeep, shelfMount].map((d) => [d.id, d]),
);

function instance(
  id: string,
  definitionId: string,
  startU: number,
): PlacedDevice {
  return { id, definitionId, startU, facing: 'front', visible: true };
}

function ctx(instances: PlacedDevice[], rackUnits = 12): PlacementContext {
  return {
    rackUnits: rackUnits as PlacementContext['rackUnits'],
    instances,
    getDefinition: (id) => DEFS.get(id),
  };
}

describe('coordinate system', () => {
  it('U1 starts at the rail base and each unit adds exactly 1U', () => {
    expect(uSlotY(1)).toBeCloseTo(railBaseY());
    expect(uSlotY(5) - uSlotY(4)).toBeCloseTo(U_METERS);
  });

  it('centers a device vertically within its units', () => {
    const { position } = devicePlacement(twoU, 3, 'front');
    expect(position[1]).toBeCloseTo(uSlotY(3) + U_METERS);
  });

  it('mounts flush against the front rail plane, extending rearward', () => {
    const { position, rotationY } = devicePlacement(oneU, 1, 'front');
    expect(position[2]).toBeCloseTo(frontRailPlaneZ() - 0.15);
    expect(rotationY).toBe(0);
  });

  it('mirrors placement and rotation for rear facing', () => {
    const { position, rotationY } = devicePlacement(oneU, 1, 'rear');
    expect(position[2]).toBeCloseTo(-(frontRailPlaneZ() - 0.15));
    expect(rotationY).toBeCloseTo(Math.PI);
  });
});

describe('occupancy', () => {
  it('maps occupied slots to instance ids', () => {
    const occupancy = buildOccupancy(
      ctx([instance('a', 'test-1u', 1), instance('b', 'test-2u', 3)]),
    );
    expect(occupancy[0]).toBe('a'); // U1
    expect(occupancy[1]).toBeNull(); // U2
    expect(occupancy[2]).toBe('b'); // U3
    expect(occupancy[3]).toBe('b'); // U4
    expect(occupancy[4]).toBeNull(); // U5
  });

  it('counts occupied units and the highest used slot', () => {
    const c = ctx([instance('a', 'test-1u', 1), instance('b', 'test-2u', 5)]);
    expect(occupiedUnits(c)).toBe(3);
    expect(maxOccupiedU(c)).toBe(6);
  });

  it('finds the lowest slot that fits, skipping gaps that are too small', () => {
    // U1 occupied, U2 free (too small for 2U against U3), U3–4 occupied.
    const c = ctx([
      instance('a', 'test-1u', 1),
      instance('b', 'test-2u', 3),
    ]);
    expect(findFirstFreeSlot(c, 1)).toBe(2);
    expect(findFirstFreeSlot(c, 2)).toBe(5);
  });

  it('returns null when nothing fits', () => {
    const c = ctx([instance('a', 'test-2u', 1)], 2);
    expect(findFirstFreeSlot(c, 1)).toBeNull();
  });
});

describe('validatePlacement', () => {
  it('accepts a valid placement', () => {
    const result = validatePlacement(oneU, 4, ctx([]));
    expect(result).toEqual({ ok: true, startU: 4 });
  });

  it('rejects placements outside the rack', () => {
    expect(validatePlacement(oneU, 0, ctx([]))).toMatchObject({
      ok: false,
      reason: 'outside-rack',
    });
    // 2U device starting on the top unit overflows.
    expect(validatePlacement(twoU, 12, ctx([]))).toMatchObject({
      ok: false,
      reason: 'outside-rack',
    });
  });

  it('rejects overlapping placements', () => {
    const c = ctx([instance('a', 'test-2u', 3)]);
    expect(validatePlacement(oneU, 4, c)).toMatchObject({
      ok: false,
      reason: 'occupied',
    });
  });

  it('ignores the moving instance itself', () => {
    const c = ctx([instance('a', 'test-2u', 3)]);
    expect(validatePlacement(twoU, 4, c, 'a')).toEqual({
      ok: true,
      startU: 4,
    });
  });

  it('rejects devices deeper than the usable mounting depth', () => {
    expect(tooDeep.depthMm).toBeGreaterThan(usableDepthMm());
    expect(validatePlacement(tooDeep, 1, ctx([]))).toMatchObject({
      ok: false,
      reason: 'too-deep',
    });
  });

  it('rejects unsupported mounting standards', () => {
    expect(validatePlacement(shelfMount, 1, ctx([]))).toMatchObject({
      ok: false,
      reason: 'unsupported-mounting',
    });
  });
});
