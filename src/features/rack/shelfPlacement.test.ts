import { describe, expect, it } from 'vitest';
import {
  buildOccupancy,
  devicePlacement,
  findFreeShelfSpot,
  isShelfDefinition,
  rackGeometry,
  rotatedFootprintMm,
  shelfDeckRect,
  surfaceDevicePlacement,
  validateSurfacePlacement,
  SHELF_CHILD_LIFT_MM,
  SHELF_DECK_TOP_MM,
  MM_TO_M,
  type PlacedDevice,
  type PlacementContext,
  type SurfacePlacement,
} from './rackMath';
import { resolveEndpoint } from '@/features/cables/anchors';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';

const GEO = rackGeometry('open-frame-700');
const shelf = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-rack-shelf-1u')!;
const ucg = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-ucg-ultra')!;

const shelfInstance: PlacedDevice = {
  id: 'shelf-1',
  definitionId: shelf.id,
  startU: 4,
  facing: 'front',
  visible: true,
};

const child = (
  over: Partial<SurfacePlacement> = {},
): SurfacePlacement => ({
  shelfId: 'shelf-1',
  xMm: 0,
  zMm: 0,
  rotationDeg: 0,
  ...over,
});

describe('surface placement math', () => {
  it('recognizes shelves and reports a usable deck', () => {
    expect(isShelfDefinition(shelf)).toBe(true);
    expect(isShelfDefinition(ucg)).toBe(false);
    const deck = shelfDeckRect(shelf);
    expect(deck.wMm).toBeLessThan(shelf.widthMm);
    expect(deck.dMm).toBeLessThan(shelf.depthMm);
  });

  it('rotated footprints swap axes at 90° and grow at 45°', () => {
    expect(rotatedFootprintMm(100, 50, 0)).toEqual({ wMm: 100, dMm: 50 });
    const ninety = rotatedFootprintMm(100, 50, 90);
    expect(ninety.wMm).toBeCloseTo(50, 6);
    expect(ninety.dMm).toBeCloseTo(100, 6);
    const diag = rotatedFootprintMm(100, 100, 45);
    expect(diag.wMm).toBeCloseTo(100 * Math.SQRT2, 6);
  });

  it('a device on the shelf stands on the deck at the placed offset', () => {
    const shelfPose = devicePlacement(shelf, 4, 'front', GEO);
    const pose = surfaceDevicePlacement(
      ucg,
      child({ xMm: 80, zMm: -20 }),
      shelf,
      shelfInstance,
      GEO,
    );
    expect(pose.position[0]).toBeCloseTo(shelfPose.position[0] + 0.08, 6);
    expect(pose.position[2]).toBeCloseTo(shelfPose.position[2] - 0.02, 6);
    const expectedY =
      shelfPose.position[1] +
      (-shelf.heightMm / 2 + SHELF_DECK_TOP_MM) * MM_TO_M +
      (SHELF_CHILD_LIFT_MM + ucg.heightMm / 2) * MM_TO_M;
    expect(pose.position[1]).toBeCloseTo(expectedY, 6);
    expect(pose.rotationY).toBeCloseTo(0, 6);
  });

  it('a rear-facing shelf mirrors offsets and adds π to child yaw', () => {
    const rear = surfaceDevicePlacement(
      ucg,
      child({ xMm: 80, rotationDeg: 90 }),
      shelf,
      { ...shelfInstance, facing: 'rear' },
      GEO,
    );
    const shelfPose = devicePlacement(shelf, 4, 'rear', GEO);
    expect(rear.position[0]).toBeCloseTo(shelfPose.position[0] - 0.08, 6);
    expect(rear.rotationY).toBeCloseTo(Math.PI + Math.PI / 2, 6);
  });
});

describe('surface placement validation', () => {
  it('rejects rack-mount hardware on shelves', () => {
    const result = validateSurfacePlacement(shelf, child(), shelf, []);
    expect(result.ok).toBe(false);
  });

  it('rejects overhang and detects collisions between shelf devices', () => {
    const centered = validateSurfacePlacement(ucg, child(), shelf, []);
    expect(centered.ok).toBe(true);

    const overhang = validateSurfacePlacement(
      ucg,
      child({ xMm: shelf.widthMm / 2 }),
      shelf,
      [],
    );
    expect(overhang.ok).toBe(false);

    const sibling = {
      instance: { ...shelfInstance, id: 'other', surface: child() },
      definition: ucg,
    };
    const colliding = validateSurfacePlacement(
      ucg,
      child({ xMm: 40 }),
      shelf,
      [sibling],
    );
    expect(colliding.ok).toBe(false);
    const clear = validateSurfacePlacement(
      ucg,
      child({ xMm: 130 }),
      shelf,
      [sibling],
    );
    expect(clear.ok).toBe(true);
    // Rotating 90° narrows the footprint across the width: a spot that
    // collided flat can clear once rotated.
    const rotatedClear = validateSurfacePlacement(
      ucg,
      child({ xMm: 125, rotationDeg: 90 }),
      shelf,
      [sibling],
    );
    expect(rotatedClear.ok).toBe(true);
  });

  it('finds a free spot, skipping occupied space', () => {
    const empty = findFreeShelfSpot(ucg, shelf, 'shelf-1', []);
    expect(empty).toEqual({ shelfId: 'shelf-1', xMm: 0, zMm: 0, rotationDeg: 0 });
    const taken = {
      instance: { ...shelfInstance, id: 'other', surface: child() },
      definition: ucg,
    };
    const spot = findFreeShelfSpot(ucg, shelf, 'shelf-1', [taken]);
    expect(spot).not.toBeNull();
    expect(
      validateSurfacePlacement(ucg, spot!, shelf, [taken]).ok,
    ).toBe(true);
  });
});

describe('occupancy and cables with shelf children', () => {
  it('shelf children never occupy rack units', () => {
    const ctx: PlacementContext = {
      rackUnits: 12,
      usableDepthMm: 700,
      shelfAvailable: true,
      instances: [
        shelfInstance,
        {
          id: 'child-1',
          definitionId: ucg.id,
          startU: 4,
          facing: 'front',
          visible: true,
          surface: child(),
        },
      ],
      getDefinition: (id) =>
        id === shelf.id ? shelf : id === ucg.id ? ucg : undefined,
    };
    const occupancy = buildOccupancy(ctx);
    expect(occupancy[3]).toBe('shelf-1');
    expect(occupancy.filter((slot) => slot === 'child-1')).toHaveLength(0);
  });

  it('cable endpoints follow a device rotated on its shelf', () => {
    const surface = child({ rotationDeg: 90 });
    const pose = surfaceDevicePlacement(ucg, surface, shelf, shelfInstance, GEO);
    const endpoint = resolveEndpoint(
      ucg,
      { startU: 4, facing: 'front' },
      GEO,
      'wan[1]',
      pose,
    )!;
    expect(endpoint).not.toBeNull();
    // The front-panel WAN port of a device yawed +90° exits along +X.
    expect(endpoint.exitDir[0]).toBeCloseTo(1, 5);
    expect(Math.abs(endpoint.exitDir[2])).toBeLessThan(1e-5);
    // And the port's world position rotates with the chassis: the WAN
    // port (device-local x = -40) lands offset along +Z from center.
    expect(endpoint.surface[2] - pose.position[2]).toBeGreaterThan(0.03);
  });
});
