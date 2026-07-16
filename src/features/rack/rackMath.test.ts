import { describe, expect, it } from 'vitest';
import {
  buildOccupancy,
  deepestDeviceDepthMm,
  devicePlacement,
  findFirstFreeSlot,
  maxOccupiedU,
  occupiedUnits,
  rackGeometry,
  rackGeometryFor,
  resolveRailSpacingMm,
  uSlotY,
  validatePlacement,
  type PlacedDevice,
  type PlacementContext,
} from './rackMath';
import { getProfile } from './rackProfiles';
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

const GEO = rackGeometry('open-frame-700');

function ctx(instances: PlacedDevice[], rackUnits = 12): PlacementContext {
  return {
    rackUnits: rackUnits as PlacementContext['rackUnits'],
    usableDepthMm: GEO.usableDepthM * 1000,
    shelfAvailable: GEO.profile.shelfCompatible,
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
    const { position } = devicePlacement(twoU, 3, 'front', GEO);
    expect(position[1]).toBeCloseTo(uSlotY(3) + U_METERS);
  });

  it('mounts flush against the front rail plane, extending rearward only', () => {
    const { position, rotationY } = devicePlacement(oneU, 1, 'front', GEO);
    expect(position[2]).toBeCloseTo(GEO.frontRailZ - 0.15);
    expect(rotationY).toBe(0);
  });

  it('mirrors placement onto the rear rail plane for rear facing', () => {
    const { position, rotationY } = devicePlacement(oneU, 1, 'rear', GEO);
    expect(position[2]).toBeCloseTo(GEO.rearRailZ + 0.15);
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
    expect(tooDeep.depthMm).toBeGreaterThan(GEO.usableDepthM * 1000);
    expect(validatePlacement(tooDeep, 1, ctx([]))).toMatchObject({
      ok: false,
      reason: 'too-deep',
    });
  });

  it('accepts shelf-mounted gear when the profile takes shelves', () => {
    expect(validatePlacement(shelfMount, 1, ctx([]))).toEqual({
      ok: true,
      startU: 1,
    });
  });

  it('rejects shelf-mounted gear when the profile has no shelves', () => {
    const noShelf = { ...ctx([]), shelfAvailable: false };
    expect(validatePlacement(shelfMount, 1, noShelf)).toMatchObject({
      ok: false,
      reason: 'unsupported-mounting',
    });
  });
});

describe('rack profiles / geometry', () => {
  it('open frames: enclosure depth equals rail spacing, planes at the faces', () => {
    const g = rackGeometry('open-frame-700');
    expect(g.externalDepthM).toBeCloseTo(0.7);
    expect(g.frontRailZ).toBeCloseTo(0.35);
    expect(g.rearRailZ).toBeCloseTo(-0.35);
    expect(g.railSpacingM).toBeCloseTo(0.7);
    expect(g.usableDepthM).toBeCloseTo(0.7);
    expect(g.hasInnerRails).toBe(false);
  });

  it('open frames adjust depth via rail spacing, clamped to the range', () => {
    const g = rackGeometry('open-frame-700', 500);
    expect(g.externalDepthM).toBeCloseTo(0.5);
    expect(g.usableDepthM).toBeCloseTo(0.5);
    // Below the range minimum clamps up to 250
    expect(rackGeometry('open-frame-700', 100).railSpacingM).toBeCloseTo(0.25);
  });

  it('cabinet: enclosure depth is independent of rail spacing', () => {
    const g = rackGeometry('cabinet-42u');
    expect(g.externalDepthM).toBeCloseTo(1.0);
    expect(g.frontRailZ).toBeCloseTo(0.4); // 100mm inset
    expect(g.rearRailZ).toBeCloseTo(0.4 - 0.75);
    expect(g.railSpacingM).toBeCloseTo(0.75);
    expect(g.usableDepthM).toBeCloseTo(0.85); // extD - inset - 50mm gap
    expect(g.hasInnerRails).toBe(true);

    const moved = rackGeometry('cabinet-42u', 600);
    expect(moved.externalDepthM).toBeCloseTo(1.0); // unchanged
    expect(moved.railSpacingM).toBeCloseTo(0.6);
    expect(moved.usableDepthM).toBeCloseTo(0.85); // unchanged
  });

  it('mini rack: fixed rails and a compact base', () => {
    const g = rackGeometry('unifi-minirack', 900);
    expect(g.railSpacingM).toBeCloseTo(0.4); // fixed, request ignored
    expect(g.externalDepthM).toBeCloseTo(0.4);
    expect(g.railBaseYM).toBeCloseTo(0.03);
  });

  it('device placement follows the compact base height', () => {
    const g = rackGeometry('unifi-minirack');
    const { position } = devicePlacement(oneU, 1, 'front', g);
    expect(position[1]).toBeCloseTo(0.03 + U_METERS / 2);
  });

  it('wall rack: shallow adjustable frame with a compact base', () => {
    const g = rackGeometry('wall-rack-9u');
    expect(g.railSpacingM).toBeCloseTo(0.45);
    expect(g.railBaseYM).toBeCloseTo(0.03);
    expect(g.hasInnerRails).toBe(false);
  });
});

describe('rail modes (auto-fit)', () => {
  const getDef = (id: string) => DEFS.get(id);

  it('reports the deepest mounted device, skipping unknown definitions', () => {
    expect(deepestDeviceDepthMm([], getDef)).toBeNull();
    expect(deepestDeviceDepthMm([instance('x', 'missing', 1)], getDef)).toBeNull();
    expect(
      deepestDeviceDepthMm(
        [instance('a', 'test-1u', 1), instance('b', 'test-deep', 2)],
        getDef,
      ),
    ).toBe(900);
  });

  it('auto mode sets the rails against the deepest device, within range', () => {
    const profile = getProfile('open-frame-700');
    expect(resolveRailSpacingMm(profile, 'auto', 700, 300)).toBe(300);
    expect(resolveRailSpacingMm(profile, 'auto', 700, 120)).toBe(250); // min
    expect(resolveRailSpacingMm(profile, 'auto', 700, 950)).toBe(700); // max
  });

  it('auto mode rests at the profile default when the rack is empty', () => {
    const profile = getProfile('open-frame-700');
    expect(resolveRailSpacingMm(profile, 'auto', 500, null)).toBe(700);
  });

  it('manual mode uses the stored spacing, clamped to the range', () => {
    const profile = getProfile('open-frame-700');
    expect(resolveRailSpacingMm(profile, 'manual', 520, 300)).toBe(520);
    expect(resolveRailSpacingMm(profile, 'manual', 100, null)).toBe(250);
  });

  it('fixed-rail profiles ignore both modes', () => {
    const profile = getProfile('unifi-minirack');
    expect(resolveRailSpacingMm(profile, 'auto', 900, 300)).toBe(400);
    expect(resolveRailSpacingMm(profile, 'manual', 900, 300)).toBe(400);
  });

  it('auto open frame: rails hug the device, usable depth stays the capability', () => {
    const g = rackGeometryFor(
      { profileId: 'open-frame-700', railMode: 'auto', railSpacingMm: 700 },
      300,
    );
    expect(g.railSpacingM).toBeCloseTo(0.3);
    expect(g.externalDepthM).toBeCloseTo(0.3);
    // Front face flush with the front rail plane.
    expect(g.frontRailZ).toBeCloseTo(g.externalDepthM / 2);
    // Placement validation accepts anything the rails can move to hold.
    expect(g.usableDepthM).toBeCloseTo(0.7);
  });

  it('a device mounts flush between the auto-fitted rails', () => {
    const g = rackGeometryFor(
      { profileId: 'open-frame-700', railMode: 'auto', railSpacingMm: 700 },
      oneU.depthMm,
    );
    const { position } = devicePlacement(oneU, 1, 'front', g);
    const halfDepth = (oneU.depthMm / 1000) / 2;
    // Faceplate on the front rail, chassis tail on the rear rail.
    expect(position[2] + halfDepth).toBeCloseTo(g.frontRailZ);
    expect(position[2] - halfDepth).toBeCloseTo(g.rearRailZ);
  });

  it('cabinet auto mode moves the inner rails without changing the enclosure', () => {
    const g = rackGeometryFor(
      { profileId: 'cabinet-42u', railMode: 'auto', railSpacingMm: 750 },
      450,
    );
    expect(g.railSpacingM).toBeCloseTo(0.45);
    expect(g.externalDepthM).toBeCloseTo(1.0);
    expect(g.usableDepthM).toBeCloseTo(0.85);
  });
});
