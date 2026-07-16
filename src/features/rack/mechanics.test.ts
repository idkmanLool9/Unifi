import { describe, expect, it } from 'vitest';
import {
  analyzeMechanics,
  chassisAabb,
  resolveMechanical,
  shelfSurfaceY,
  solveMounting,
  REAR_EAR_REACH_MM,
} from './mechanics';
import {
  devicePlacement,
  rackGeometry,
  rackGeometryFor,
  SHELF_THICKNESS_M,
  type PlacedDevice,
} from './rackMath';
import { U_METERS } from './rackConstants';
import { defineDevice } from '@/features/devices/definitions/defineDevice';

const rackDevice = defineDevice({
  id: 'mech-1u',
  slug: 'mech-1u',
  manufacturer: 'testco',
  manufacturerName: 'TestCo',
  productName: 'Mech 1U',
  modelNumber: 'M1',
  category: 'switching',
  rackUnits: 1,
  depthMm: 286,
  weightKg: 3,
  powerConsumptionWatts: 20,
  maximumPowerWatts: 30,
  description: 'test',
  presentation: { faceplate: 'network', tone: 'dark' },
});

const shelfDevice = defineDevice({
  ...rackDevice,
  id: 'mech-shelf',
  slug: 'mech-shelf',
  productName: 'Mech Shelf Box',
  mountingStandard: 'none',
  widthMm: 300,
  heightMm: 40,
  depthMm: 390,
});

const instance = (
  id: string,
  definitionId: string,
  startU: number,
): PlacedDevice => ({ id, definitionId, startU, facing: 'front', visible: true });

describe('resolveMechanical', () => {
  it('derives style from the mounting standard', () => {
    expect(resolveMechanical(rackDevice).mountStyle).toBe('rack-ears');
    expect(resolveMechanical(shelfDevice).mountStyle).toBe('shelf');
  });

  it('applies sheet-steel defaults and lets metadata win', () => {
    expect(resolveMechanical(rackDevice).earThicknessMm).toBe(2.5);
    const custom = defineDevice({
      ...rackDevice,
      id: 'mech-custom',
      mechanical: { earThicknessMm: 4, integratedEars: true, centerOfMassMm: [0, -5, 30] },
    });
    const resolved = resolveMechanical(custom);
    expect(resolved.earThicknessMm).toBe(4);
    expect(resolved.integratedEars).toBe(true);
    expect(resolved.centerOfMassMm).toEqual([0, -5, 30]);
  });
});

describe('solveMounting', () => {
  it('auto-hugged rails carry the tail on rear brackets', () => {
    const geometry = rackGeometryFor(
      { profileId: 'open-frame-700', railMode: 'auto', railSpacingMm: 700 },
      rackDevice.depthMm,
    );
    const solution = solveMounting(rackDevice, geometry);
    expect(solution.frontEars).toBe(true);
    expect(solution.rearSupport).toBe('rear-ears');
    expect(Math.abs(solution.rearGapMm)).toBeLessThanOrEqual(REAR_EAR_REACH_MM);
    expect(solution.exceedsRailSpacing).toBe(false);
  });

  it('deep frames with support rails carry a short chassis on them', () => {
    const geometry = rackGeometry('open-frame-800'); // supportRails: true
    const solution = solveMounting(rackDevice, geometry);
    expect(solution.rearSupport).toBe('support-rails');
    expect(solution.rearGapMm).toBeCloseTo(800 - 286, 0);
  });

  it('front-ear cantilever when the profile has no rear support', () => {
    const geometry = rackGeometry('open-frame-700'); // supportRails: false
    expect(solveMounting(rackDevice, geometry).rearSupport).toBe('none');
  });

  it('integrated ears suppress the parametric ones', () => {
    const integrated = defineDevice({
      ...rackDevice,
      id: 'mech-int',
      mechanical: { integratedEars: true },
    });
    const geometry = rackGeometry('open-frame-700');
    expect(solveMounting(integrated, geometry).frontEars).toBe(false);
  });

  it('shelf devices rest on a shelf', () => {
    const geometry = rackGeometry('open-frame-700');
    const solution = solveMounting(shelfDevice, geometry);
    expect(solution.onShelf).toBe(true);
    expect(solution.rearSupport).toBe('shelf');
    expect(solution.frontEars).toBe(false);
  });

  it('flags a chassis deeper than the rail spacing', () => {
    const geometry = rackGeometry('open-frame-700', 250);
    const solution = solveMounting(rackDevice, geometry);
    expect(solution.exceedsRailSpacing).toBe(true);
    expect(solution.rearGapMm).toBeLessThan(0);
  });
});

describe('shelf placement', () => {
  it('seats shelf devices on the shelf surface, not hanging from rails', () => {
    const geometry = rackGeometry('open-frame-700');
    const { position } = devicePlacement(shelfDevice, 2, 'front', geometry);
    const shelfTop = shelfSurfaceY(2, geometry);
    expect(shelfTop).toBeCloseTo(
      geometry.railBaseYM + U_METERS + SHELF_THICKNESS_M,
    );
    expect(position[1]).toBeCloseTo(shelfTop + (shelfDevice.heightMm / 1000) / 2);
  });
});

describe('analyzeMechanics (geometry only)', () => {
  const getDef = (id: string) =>
    ({ 'mech-1u': rackDevice, 'mech-shelf': shelfDevice })[id];

  it('reports clean facts for a properly carried device', () => {
    const geometry = rackGeometryFor(
      { profileId: 'open-frame-700', railMode: 'auto', railSpacingMm: 700 },
      rackDevice.depthMm,
    );
    const [facts] = analyzeMechanics(
      [instance('a', 'mech-1u', 1)],
      geometry,
      getDef,
    );
    expect(facts.rearBracketCollides).toBe(false);
    expect(facts.exceedsRailSpacing).toBe(false);
    expect(facts.overlappingInstanceIds).toEqual([]);
  });

  it('knows when the tail passes through the rear rail plane', () => {
    const geometry = rackGeometry('open-frame-700', 250);
    const [facts] = analyzeMechanics(
      [instance('a', 'mech-1u', 1)],
      geometry,
      getDef,
    );
    expect(facts.rearBracketCollides).toBe(true);
    expect(facts.exceedsRailSpacing).toBe(true);
  });

  it('knows when a shelf would be deeper than the rails carry', () => {
    // 390mm device + 20mm lip = 410mm shelf on 400mm fixed rails.
    const geometry = rackGeometry('unifi-minirack');
    const [facts] = analyzeMechanics(
      [instance('a', 'mech-shelf', 1)],
      geometry,
      getDef,
    );
    expect(facts.shelfIntersectsRails).toBe(true);
  });

  it('detects overlapping chassis volumes', () => {
    const geometry = rackGeometry('open-frame-700');
    const facts = analyzeMechanics(
      [instance('a', 'mech-1u', 1), instance('b', 'mech-1u', 1)],
      geometry,
      getDef,
    );
    expect(facts[0].overlappingInstanceIds).toEqual(['b']);
    expect(facts[1].overlappingInstanceIds).toEqual(['a']);
  });

  it('keeps separated devices overlap-free', () => {
    const geometry = rackGeometry('open-frame-700');
    const facts = analyzeMechanics(
      [instance('a', 'mech-1u', 1), instance('b', 'mech-1u', 2)],
      geometry,
      getDef,
    );
    expect(facts.every((f) => f.overlappingInstanceIds.length === 0)).toBe(true);
  });

  it('chassis boxes sit flush against the front rail plane', () => {
    const geometry = rackGeometry('open-frame-700');
    const box = chassisAabb(rackDevice, { startU: 1, facing: 'front' }, geometry);
    expect(box.max[2]).toBeCloseTo(geometry.frontRailZ);
    expect(box.min[2]).toBeCloseTo(geometry.frontRailZ - rackDevice.depthMm / 1000);
  });
});
