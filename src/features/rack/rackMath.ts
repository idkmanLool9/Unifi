import { RACK_DIMS, U_METERS, railBaseY } from './rackConstants';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { RackOrientation, RackSize } from '@/types';

/** Millimeters to meters. */
export const MM_TO_M = 0.001;

/** Z of the front mounting plane (outer face of the front rails). */
export const frontRailPlaneZ = (): number =>
  RACK_DIMS.depth / 2 + RACK_DIMS.uprightD / 2;

/**
 * Usable mounting depth in millimeters: front rail plane to the rear rail
 * plane. Devices deeper than this cannot be mounted in the open frame.
 */
export const usableDepthMm = (): number =>
  (RACK_DIMS.depth + RACK_DIMS.uprightD) / MM_TO_M;

/** World Y of the bottom of a U slot (U1 = 1, counted from the bottom). */
export const uSlotY = (startU: number): number =>
  railBaseY() + (startU - 1) * U_METERS;

/** World-space center position for a mounted device. */
export function devicePlacement(
  definition: DeviceDefinition,
  startU: number,
  facing: RackOrientation,
): { position: [number, number, number]; rotationY: number } {
  const y =
    uSlotY(startU) +
    (definition.rackUnits * U_METERS) / 2 +
    definition.mountingOffsetMm * MM_TO_M;
  const halfDepth = (definition.depthMm * MM_TO_M) / 2;
  const plane = frontRailPlaneZ();
  const z = facing === 'front' ? plane - halfDepth : -plane + halfDepth;
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

  if (definition.depthMm > usableDepthMm()) {
    return {
      ok: false,
      reason: 'too-deep',
      message: `${definition.productName} is ${definition.depthMm} mm deep — deeper than this rack's ${Math.round(usableDepthMm())} mm mounting depth.`,
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
