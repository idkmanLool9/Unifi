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
  // Enclosed profiles reserve the profile's rear clearance behind the
  // rails; every profile caps device depth at its own hard maximum.
  const usableDepthM = Math.min(
    hasInnerRails
      ? externalDepthM - insetM - profile.rearClearanceMm * MM_TO_M
      : spacingM,
    profile.maxDeviceDepthMm * MM_TO_M,
  );

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

/** Working room behind a mounted shelf (cables of shelf devices), mm. */
export const SHELF_REAR_CLEARANCE_MM = 140;

/** Deepest mounted device in millimeters, or null for an empty rack.
 *  Shelves demand extra rear clearance so the auto-sized rack never
 *  hugs the shelf edge — the gear standing on it needs cable room. */
export function deepestDeviceDepthMm(
  instances: readonly PlacedDevice[],
  getDefinition: (id: string) => DeviceDefinition | undefined,
): number | null {
  let deepest = 0;
  for (const instance of instances) {
    const definition = getDefinition(instance.definitionId);
    if (!definition) continue;
    const effective =
      definition.accessoryKind === 'cantilever-shelf' ||
      definition.accessoryKind === 'fixed-shelf'
        ? definition.depthMm + SHELF_REAR_CLEARANCE_MM
        : definition.depthMm;
    deepest = Math.max(deepest, effective);
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
    geometry.usableDepthM =
      Math.min(profile.railSpacingRange.maxMm, profile.maxDeviceDepthMm) *
      MM_TO_M;
  }
  return geometry;
}

/** World Y of the bottom of a U slot (U1 = 1, counted from the bottom). */
export const uSlotY = (startU: number, railBaseYM = railBaseY()): number =>
  railBaseYM + (startU - 1) * U_METERS;

/** Shelf surface thickness (steel plate + folded lip), meters. */
export const SHELF_THICKNESS_M = 0.012;

/** Non-rack devices rest on a shelf surface instead of bolting to rails. */
export const isShelfMounted = (definition: DeviceDefinition): boolean =>
  definition.mountingStandard !== 'eia-310';

/** World-space center position for a mounted device. Rack devices mount
 *  to a single rail plane (front or rear) and extend inward from it —
 *  they are never stretched between the two planes. Shelf-mounted
 *  devices sit on the shelf surface at their slot instead of hanging
 *  from the rails. */
export function devicePlacement(
  definition: DeviceDefinition,
  startU: number,
  facing: RackOrientation,
  geometry: RackGeometry,
): { position: [number, number, number]; rotationY: number } {
  const onShelf = isShelfMounted(definition);
  const y = onShelf
    ? uSlotY(startU, geometry.railBaseYM) +
      SHELF_THICKNESS_M +
      (definition.heightMm * MM_TO_M) / 2 +
      definition.mountingOffsetMm * MM_TO_M
    : uSlotY(startU, geometry.railBaseYM) +
      (definition.rackUnits * U_METERS) / 2 +
      definition.mountingOffsetMm * MM_TO_M;
  const halfDepth = (definition.depthMm * MM_TO_M) / 2;
  const z =
    facing === 'front'
      ? geometry.frontRailZ - halfDepth
      : geometry.rearRailZ + halfDepth;
  // Authored mount correction, in device-local mm: +z is toward the
  // device's own faceplate, so the fix mirrors correctly when the
  // device is mounted facing the rear.
  const flip = facing === 'front' ? 1 : -1;
  const [mx, my, mz] = definition.mountOffsetMm ?? [0, 0, 0];
  return {
    position: [
      flip * mx * MM_TO_M,
      y + my * MM_TO_M,
      z + flip * mz * MM_TO_M,
    ],
    rotationY: facing === 'front' ? 0 : Math.PI,
  };
}

/**
 * Free placement on a shelf deck. The child stands on the shelf's
 * surface at a millimeter offset from the deck center, rotated by an
 * arbitrary yaw — it moves with the shelf and never occupies rack
 * units of its own.
 */
export interface SurfacePlacement {
  /** Instance id of the shelf this device stands on. */
  shelfId: string;
  /** Offset across the shelf width, mm from the deck center. */
  xMm: number;
  /** Offset along the shelf depth, mm from the deck center (+ front). */
  zMm: number;
  /** Yaw on the deck, degrees (0 = facing the same way as the shelf). */
  rotationDeg: number;
}

/** A mounted device as stored — kept minimal and serializable. */
export interface PlacedDevice {
  id: string;
  definitionId: string;
  startU: number;
  facing: RackOrientation;
  visible: boolean;
  /** Present when the device stands on a shelf instead of the rails. */
  surface?: SurfacePlacement;
}

/** A world pose every placement path resolves to. */
export interface DevicePose {
  position: [number, number, number];
  rotationY: number;
}

/* ---- shelf-surface placement ------------------------------------------ */

/** Deck top above the shelf chassis bottom (plate + clearance), mm. */
export const SHELF_DECK_TOP_MM = 6.2;
/** Rubber-foot lift of a desktop device standing on the deck, mm. */
export const SHELF_CHILD_LIFT_MM = 3;

/** True for shelf accessories that expose a placement surface. */
export const isShelfDefinition = (definition: DeviceDefinition): boolean =>
  definition.accessoryKind === 'cantilever-shelf' ||
  definition.accessoryKind === 'fixed-shelf';

/** Usable deck area of a shelf (skirts and folds excluded), mm. */
export const shelfDeckRect = (
  shelf: DeviceDefinition,
): { wMm: number; dMm: number } => ({
  wMm: shelf.widthMm - 14,
  dMm: shelf.depthMm * 0.92,
});

/** Axis-aligned footprint of a device yawed on the deck, mm. */
export function rotatedFootprintMm(
  widthMm: number,
  depthMm: number,
  rotationDeg: number,
): { wMm: number; dMm: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    wMm: widthMm * cos + depthMm * sin,
    dMm: widthMm * sin + depthMm * cos,
  };
}

/** World pose of a device standing on a shelf. */
export function surfaceDevicePlacement(
  definition: DeviceDefinition,
  surface: SurfacePlacement,
  shelfDefinition: DeviceDefinition,
  shelfInstance: Pick<PlacedDevice, 'startU' | 'facing'>,
  geometry: RackGeometry,
): DevicePose {
  const shelf = devicePlacement(
    shelfDefinition,
    shelfInstance.startU,
    shelfInstance.facing,
    geometry,
  );
  const deckTopY =
    shelf.position[1] +
    (-shelfDefinition.heightMm / 2 + SHELF_DECK_TOP_MM) * MM_TO_M;
  // Deck-local offset rotated through the shelf's own yaw.
  const cos = Math.cos(shelf.rotationY);
  const sin = Math.sin(shelf.rotationY);
  const xM = surface.xMm * MM_TO_M;
  const zM = surface.zMm * MM_TO_M;
  return {
    position: [
      shelf.position[0] + cos * xM + sin * zM,
      deckTopY + (SHELF_CHILD_LIFT_MM + definition.heightMm / 2) * MM_TO_M,
      shelf.position[2] + -sin * xM + cos * zM,
    ],
    rotationY: shelf.rotationY + (surface.rotationDeg * Math.PI) / 180,
  };
}

export type SurfaceResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Validates standing a device on a shelf: the device must be
 * non-rackmount hardware, its (rotated) footprint must fit the usable
 * deck, and it must not overlap other devices on the same shelf.
 */
export function validateSurfacePlacement(
  definition: DeviceDefinition,
  surface: SurfacePlacement,
  shelfDefinition: DeviceDefinition,
  siblings: ReadonlyArray<{
    instance: PlacedDevice;
    definition: DeviceDefinition;
  }>,
  ignoreInstanceId?: string,
): SurfaceResult {
  if (definition.mountingStandard === 'eia-310') {
    return {
      ok: false,
      message: `${definition.productName} is rack-mount hardware — mount it on the rails instead of a shelf.`,
    };
  }
  const deck = shelfDeckRect(shelfDefinition);
  const foot = rotatedFootprintMm(
    definition.widthMm,
    definition.depthMm,
    surface.rotationDeg,
  );
  if (
    Math.abs(surface.xMm) + foot.wMm / 2 > deck.wMm / 2 ||
    Math.abs(surface.zMm) + foot.dMm / 2 > deck.dMm / 2
  ) {
    return {
      ok: false,
      message: `${definition.productName} would hang over the edge of the shelf.`,
    };
  }
  for (const sibling of siblings) {
    if (sibling.instance.id === ignoreInstanceId) continue;
    const other = sibling.instance.surface;
    if (!other || other.shelfId !== surface.shelfId) continue;
    const otherFoot = rotatedFootprintMm(
      sibling.definition.widthMm,
      sibling.definition.depthMm,
      other.rotationDeg,
    );
    if (
      Math.abs(surface.xMm - other.xMm) < (foot.wMm + otherFoot.wMm) / 2 &&
      Math.abs(surface.zMm - other.zMm) < (foot.dMm + otherFoot.dMm) / 2
    ) {
      return {
        ok: false,
        message: `That spot collides with ${sibling.definition.productName} on the same shelf.`,
      };
    }
  }
  return { ok: true };
}

/**
 * First free spot for a device on a shelf, scanning left to right and
 * front to back on a small grid. Null when nothing fits.
 */
export function findFreeShelfSpot(
  definition: DeviceDefinition,
  shelfDefinition: DeviceDefinition,
  shelfId: string,
  siblings: ReadonlyArray<{
    instance: PlacedDevice;
    definition: DeviceDefinition;
  }>,
): SurfacePlacement | null {
  const deck = shelfDeckRect(shelfDefinition);
  const stepMm = 10;
  for (let z = 0; z <= deck.dMm / 2; z += stepMm) {
    for (const zSign of z === 0 ? [1] : [1, -1]) {
      for (let x = 0; x <= deck.wMm / 2; x += stepMm) {
        for (const xSign of x === 0 ? [1] : [-1, 1]) {
          const candidate: SurfacePlacement = {
            shelfId,
            xMm: xSign * x,
            zMm: zSign * z,
            rotationDeg: 0,
          };
          if (
            validateSurfacePlacement(
              definition,
              candidate,
              shelfDefinition,
              siblings,
            ).ok
          ) {
            return candidate;
          }
        }
      }
    }
  }
  return null;
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
  /** The rack profile accepts shelves for non-rack (mounting 'none') gear. */
  shelfAvailable: boolean;
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
    // Shelf children live on their shelf's surface — the shelf itself
    // owns the rack units.
    if (instance.surface) continue;
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
  if (definition.mountingStandard !== 'eia-310' && !ctx.shelfAvailable) {
    return {
      ok: false,
      reason: 'unsupported-mounting',
      message: `${definition.productName} needs a shelf, and this rack does not take shelves.`,
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
