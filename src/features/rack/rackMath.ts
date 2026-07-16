import { RACK_DIMS, U_METERS, railBaseY } from './rackConstants';
import {
  clampRailSpacingMm,
  getProfile,
  type RackProfile,
  type RackProfileId,
} from './rackProfiles';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { RackConfig, RackOrientation, RackSize } from '@/types';

/** Millimeters to meters. */
export const MM_TO_M = 0.001;

/**
 * Resolved physical geometry for a rack instance. Distinguishes the
 * quantities the engine previously conflated: enclosure (external) depth,
 * the two rail mounting planes, rail spacing and usable device depth.
 * All values in meters, world-space (rack centered at x = z = 0).
 */
export interface RackGeometry {
  profile: RackProfile;
  externalDepthM: number;
  externalWidthM: number;
  /** Front mounting plane (devices' faceplates sit flush here). */
  frontRailZ: number;
  /** Rear mounting plane (rear-facing devices sit flush here). */
  rearRailZ: number;
  railSpacingM: number;
  /** Deepest mountable device. */
  usableDepthM: number;
  /** Center z of the front / rear corner posts. */
  postFrontZ: number;
  postRearZ: number;
  /** True when rails are separate from the corner posts (cabinet). */
  hasInnerRails: boolean;
  /** Y where U1 begins (compact bases sit lower). */
  railBaseYM: number;
}

/** Clearance kept behind a cabinet's interior for cabling. */
const CABINET_REAR_GAP_M = 0.05;
/** Compact (desktop) base height, feet included. */
const COMPACT_BASE_Y = 0.03;

export function rackGeometry(
  profileId: RackProfileId,
  railSpacingMm?: number,
): RackGeometry {
  const profile = getProfile(profileId);
  const spacingM =
    clampRailSpacingMm(profile, railSpacingMm ?? profile.fixedRailSpacingMm) *
    MM_TO_M;
  const insetM = profile.frontRailInsetMm * MM_TO_M;
  const hasInnerRails = insetM > 0;

  // Open frames adjust depth by moving the rear posts: the enclosure IS
  // the rail spacing. Cabinets have a fixed enclosure with rails inside.
  const externalDepthM = hasInnerRails
    ? profile.externalDepthMm * MM_TO_M
    : spacingM;

  const frontRailZ = externalDepthM / 2 - insetM;
  const rearRailZ = frontRailZ - spacingM;
  const usableDepthM = hasInnerRails
    ? externalDepthM - insetM - CABINET_REAR_GAP_M
    : spacingM;

  return {
    profile,
    externalDepthM,
    externalWidthM: profile.externalWidthMm * MM_TO_M,
    frontRailZ,
    rearRailZ,
    railSpacingM: spacingM,
    usableDepthM,
    postFrontZ: externalDepthM / 2 - RACK_DIMS.uprightD / 2,
    postRearZ: -(externalDepthM / 2 - RACK_DIMS.uprightD / 2),
    hasInnerRails,
    railBaseYM:
      profile.baseType === 'compact-feet' ? COMPACT_BASE_Y : railBaseY(),
  };
}

/** Overall rack height for a profile, floor to top of frame. */
export const rackHeightFor = (
  units: RackSize,
  geometry: RackGeometry,
): number => geometry.railBaseYM + units * U_METERS + RACK_DIMS.topH;

export type RailMode = 'auto' | 'manual';

/** Deepest mounted device in millimeters, or null for an empty rack. */
export function deepestDeviceDepthMm(
  instances: readonly PlacedDevice[],
  getDefinition: (id: string) => DeviceDefinition | undefined,
): number | null {
  let deepest = 0;
  for (const instance of instances) {
    const definition = getDefinition(instance.definitionId);
    if (definition) deepest = Math.max(deepest, definition.depthMm);
  }
  return deepest > 0 ? deepest : null;
}

/**
 * Resolves the effective rail spacing. In 'auto' the rack behaves like a
 * real installation: the rear rails are set against the deepest installed
 * device (clamped to the profile's range), so front AND rear mounting
 * ears land on the rails. Empty racks rest at the profile default.
 */
export function resolveRailSpacingMm(
  profile: RackProfile,
  railMode: RailMode,
  manualSpacingMm: number,
  deepestDeviceMm: number | null,
): number {
  if (!profile.railSpacingRange) return profile.fixedRailSpacingMm;
  if (railMode === 'manual') {
    return clampRailSpacingMm(profile, manualSpacingMm);
  }
  if (deepestDeviceMm === null) return profile.railSpacingRange.defaultMm;
  return clampRailSpacingMm(profile, Math.ceil(deepestDeviceMm));
}

/**
 * Geometry for a rack instance, with auto rail resolution applied.
 * In auto mode an adjustable open frame accepts anything up to its range
 * maximum — the rails will move to meet the device — so usable depth
 * reports the rack's capability rather than the current rail position.
 */
export function rackGeometryFor(
  rack: Pick<RackConfig, 'profileId' | 'railMode' | 'railSpacingMm'>,
  deepestDeviceMm: number | null,
): RackGeometry {
  const profile = getProfile(rack.profileId);
  const spacing = resolveRailSpacingMm(
    profile,
    rack.railMode,
    rack.railSpacingMm,
    deepestDeviceMm,
  );
  const geometry = rackGeometry(rack.profileId, spacing);
  if (
    rack.railMode === 'auto' &&
    profile.railSpacingRange &&
    !geometry.hasInnerRails
  ) {
    geometry.usableDepthM = profile.railSpacingRange.maxMm * MM_TO_M;
  }
  return geometry;
}

/** World Y of the bottom of a U slot (U1 = 1, counted from the bottom). */
export const uSlotY = (startU: number, railBaseYM = railBaseY()): number =>
  railBaseYM + (startU - 1) * U_METERS;

/** World-space center position for a mounted device. Devices mount to a
 *  single rail plane (front or rear) and extend inward from it — they are
 *  never stretched between the two planes. */
export function devicePlacement(
  definition: DeviceDefinition,
  startU: number,
  facing: RackOrientation,
  geometry: RackGeometry,
): { position: [number, number, number]; rotationY: number } {
  const y =
    uSlotY(startU, geometry.railBaseYM) +
    (definition.rackUnits * U_METERS) / 2 +
    definition.mountingOffsetMm * MM_TO_M;
  const halfDepth = (definition.depthMm * MM_TO_M) / 2;
  const z =
    facing === 'front'
      ? geometry.frontRailZ - halfDepth
      : geometry.rearRailZ + halfDepth;
  return {
    position: [0, y, z],
    rotationY: facing === 'front' ? 0 : Math.PI,
  };
}

/** A mounted device as stored — kept minimal and serializable. */
export interface PlacedDevice {
  id: string;
  definitionId: string;
  startU: number;
  facing: RackOrientation;
  visible: boolean;
}

export type PlacementFailure =
  | 'no-rack'
  | 'outside-rack'
  | 'occupied'
  | 'too-deep'
  | 'unsupported-mounting'
  | 'unknown-device';

export type PlacementResult =
  | { ok: true; startU: number }
  | { ok: false; reason: PlacementFailure; message: string };

export interface PlacementContext {
  rackUnits: RackSize;
  /** Deepest device the rack's current rail configuration accepts. */
  usableDepthMm: number;
  instances: readonly PlacedDevice[];
  getDefinition: (id: string) => DeviceDefinition | undefined;
}

/**
 * Builds a rack occupancy map: index 0 = U1. Each slot holds the occupying
 * instance id or null. Instances with unknown definitions are skipped.
 */
export function buildOccupancy(ctx: PlacementContext): (string | null)[] {
  const slots: (string | null)[] = Array.from(
    { length: ctx.rackUnits },
    () => null,
  );
  for (const instance of ctx.instances) {
    const definition = ctx.getDefinition(instance.definitionId);
    if (!definition) continue;
    for (let u = instance.startU; u < instance.startU + definition.rackUnits; u++) {
      if (u >= 1 && u <= ctx.rackUnits) slots[u - 1] = instance.id;
    }
  }
  return slots;
}

/** Total units occupied by mounted devices. */
export function occupiedUnits(ctx: PlacementContext): number {
  return buildOccupancy(ctx).filter((slot) => slot !== null).length;
}

/** Highest occupied U, or 0 when the rack is empty. */
export function maxOccupiedU(ctx: PlacementContext): number {
  const occupancy = buildOccupancy(ctx);
  for (let i = occupancy.length - 1; i >= 0; i--) {
    if (occupancy[i] !== null) return i + 1;
  }
  return 0;
}

/**
 * Finds the lowest free slot able to hold `units` consecutive rack units,
 * or null when the rack cannot fit the device.
 */
export function findFirstFreeSlot(
  ctx: PlacementContext,
  units: number,
): number | null {
  const occupancy = buildOccupancy(ctx);
  for (let start = 1; start + units - 1 <= ctx.rackUnits; start++) {
    let free = true;
    for (let u = start; u < start + units; u++) {
      if (occupancy[u - 1] !== null) {
        free = false;
        break;
      }
    }
    if (free) return start;
  }
  return null;
}

/**
 * Validates placing (or moving) a device at `startU`. Pass
 * `ignoreInstanceId` when moving so a device doesn't collide with itself.
 */
export function validatePlacement(
  definition: DeviceDefinition,
  startU: number,
  ctx: PlacementContext,
  ignoreInstanceId?: string,
): PlacementResult {
  if (definition.mountingStandard !== 'eia-310') {
    return {
      ok: false,
      reason: 'unsupported-mounting',
      message: `${definition.productName} does not use EIA-310 rack mounting.`,
    };
  }

  if (definition.depthMm > ctx.usableDepthMm) {
    return {
      ok: false,
      reason: 'too-deep',
      message: `${definition.productName} is ${definition.depthMm} mm deep — deeper than this rack's ${Math.round(ctx.usableDepthMm)} mm usable depth.`,
    };
  }

  const endU = startU + definition.rackUnits - 1;
  if (!Number.isInteger(startU) || startU < 1 || endU > ctx.rackUnits) {
    return {
      ok: false,
      reason: 'outside-rack',
      message: `U${startU}–U${endU} falls outside this ${ctx.rackUnits}U rack.`,
    };
  }

  const occupancy = buildOccupancy(ctx);
  for (let u = startU; u <= endU; u++) {
    const occupant = occupancy[u - 1];
    if (occupant !== null && occupant !== ignoreInstanceId) {
      return {
        ok: false,
        reason: 'occupied',
        message: `U${u} is already occupied by another device.`,
      };
    }
  }

  return { ok: true, startU };
}
