import { U_METERS } from './rackConstants';
import {
  devicePlacement,
  MM_TO_M,
  SHELF_THICKNESS_M,
  type PlacedDevice,
  type RackGeometry,
} from './rackMath';
import type {
  DeviceDefinition,
  MountStyle,
  RailKitType,
} from '@/features/devices/deviceSchema';

/**
 * Mechanical layer: how devices physically attach to the rack. Purely
 * geometric and metadata-driven — no device-specific code paths, no UI.
 * The hardware renderer and (future) smart validation consume this.
 */

/** Mechanical contact values with every default applied, in millimeters. */
export interface ResolvedMechanical {
  mountStyle: MountStyle;
  /** Front mounting plane, mm behind the faceplate. */
  frontMountPlaneMm: number;
  /** Rear support plane, mm ahead of the chassis rear face. */
  rearSupportPlaneMm: number;
  /** Bottom support plane, mm above the chassis underside. */
  bottomSupportPlaneMm: number;
  earThicknessMm: number;
  earOffsetMm: number;
  integratedEars: boolean;
  /** Center of mass, mm from the chassis center. */
  centerOfMassMm: [number, number, number];
  railType: RailKitType;
}

/** Typical mounting-ear sheet steel. */
export const DEFAULT_EAR_THICKNESS_MM = 2.5;

/** Applies the documented defaults to a device's mechanical metadata. */
export function resolveMechanical(
  definition: DeviceDefinition,
): ResolvedMechanical {
  const m = definition.mechanical ?? {};
  return {
    mountStyle:
      m.mountStyle ??
      (definition.mountingStandard === 'eia-310' ? 'rack-ears' : 'shelf'),
    frontMountPlaneMm: m.frontMountPlaneMm ?? 0,
    rearSupportPlaneMm: m.rearSupportPlaneMm ?? 0,
    bottomSupportPlaneMm: m.bottomSupportPlaneMm ?? 0,
    earThicknessMm: m.earThicknessMm ?? DEFAULT_EAR_THICKNESS_MM,
    earOffsetMm: m.earOffsetMm ?? 0,
    integratedEars: m.integratedEars ?? false,
    centerOfMassMm: m.centerOfMassMm ?? [0, 0, 0],
    railType: m.railType ?? 'none',
  };
}

/** How the rear of a mounted device is physically carried. */
export type RearSupport = 'rear-ears' | 'support-rails' | 'shelf' | 'none';

/** Rear brackets reach the rear rails when the tail is within this gap. */
export const REAR_EAR_REACH_MM = 25;

export interface MountingSolution {
  style: MountStyle;
  /** Parametric front ears are rendered (not integrated into the GLB). */
  frontEars: boolean;
  rearSupport: RearSupport;
  /** Chassis rear support plane → rear rail plane, mm (+ = rail behind). */
  rearGapMm: number;
  /** Device rests on a shelf surface instead of bolting to rails. */
  onShelf: boolean;
  /** The chassis is deeper than the current rail spacing. */
  exceedsRailSpacing: boolean;
  mechanical: ResolvedMechanical;
}

/**
 * Solves how a device is carried by the current rack geometry — the
 * single decision point the hardware renderer draws from:
 *
 * - front ears bolt to the front rail plane (unless the model integrates
 *   its own or the device is shelf-mounted);
 * - the rear is carried by rear brackets when the tail reaches the rear
 *   rails, by full-length side support rails when the profile provides
 *   them, and is a legitimate front-ear cantilever otherwise;
 * - shelf-mounted devices rest on a shelf surface.
 */
export function solveMounting(
  definition: DeviceDefinition,
  geometry: RackGeometry,
): MountingSolution {
  const mechanical = resolveMechanical(definition);
  const spacingMm = geometry.railSpacingM / MM_TO_M;
  const onShelf =
    mechanical.mountStyle === 'shelf' || mechanical.mountStyle === 'desktop';

  const rearPlaneBehindFaceMm =
    definition.depthMm - mechanical.rearSupportPlaneMm;
  const rearGapMm = spacingMm - mechanical.frontMountPlaneMm - rearPlaneBehindFaceMm;
  const exceedsRailSpacing = definition.depthMm > spacingMm;

  let rearSupport: RearSupport;
  if (onShelf) {
    rearSupport = 'shelf';
  } else if (Math.abs(rearGapMm) <= REAR_EAR_REACH_MM) {
    rearSupport = 'rear-ears';
  } else if (rearGapMm > 0 && geometry.profile.supportRails) {
    rearSupport = 'support-rails';
  } else {
    rearSupport = 'none';
  }

  return {
    style: mechanical.mountStyle,
    frontEars: !onShelf && !mechanical.integratedEars,
    rearSupport,
    rearGapMm: Math.round(rearGapMm * 10) / 10,
    onShelf,
    exceedsRailSpacing,
    mechanical,
  };
}

/* ---- Mechanical collision (geometry only, no warnings) --------------- */

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

export const aabbsIntersect = (a: Aabb, b: Aabb): boolean =>
  a.min[0] < b.max[0] &&
  a.max[0] > b.min[0] &&
  a.min[1] < b.max[1] &&
  a.max[1] > b.min[1] &&
  a.min[2] < b.max[2] &&
  a.max[2] > b.min[2];

/** World-space chassis AABB of a mounted device (meters). */
export function chassisAabb(
  definition: DeviceDefinition,
  instance: Pick<PlacedDevice, 'startU' | 'facing'>,
  geometry: RackGeometry,
): Aabb {
  const { position } = devicePlacement(
    definition,
    instance.startU,
    instance.facing,
    geometry,
  );
  const half: [number, number, number] = [
    (definition.widthMm * MM_TO_M) / 2,
    (definition.heightMm * MM_TO_M) / 2,
    (definition.depthMm * MM_TO_M) / 2,
  ];
  return {
    min: [position[0] - half[0], position[1] - half[1], position[2] - half[2]],
    max: [position[0] + half[0], position[1] + half[1], position[2] + half[2]],
  };
}

export interface MechanicalFacts {
  instanceId: string;
  solution: MountingSolution;
  /** Chassis tail passes through the rear rail plane. */
  rearBracketCollides: boolean;
  /** A shelf surface would be deeper than the rail spacing carries. */
  shelfIntersectsRails: boolean;
  /** Chassis is deeper than the current rail spacing. */
  exceedsRailSpacing: boolean;
  /** Instance ids whose chassis volume this device's volume overlaps. */
  overlappingInstanceIds: string[];
}

/** Shelf surfaces extend this far past the device footprint. */
export const SHELF_LIP_MM = 20;

/**
 * Computes the mechanical facts for every mounted device: how it is
 * carried, and whether any purely geometric conflicts exist. No
 * warnings, no UI — downstream layers decide what to surface.
 */
export function analyzeMechanics(
  instances: readonly PlacedDevice[],
  geometry: RackGeometry,
  getDefinition: (id: string) => DeviceDefinition | undefined,
): MechanicalFacts[] {
  const mounted = instances
    .map((instance) => {
      const definition = getDefinition(instance.definitionId);
      return definition ? { instance, definition } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const boxes = mounted.map(({ instance, definition }) => ({
    id: instance.id,
    box: chassisAabb(definition, instance, geometry),
  }));

  const spacingMm = geometry.railSpacingM / MM_TO_M;

  return mounted.map(({ instance, definition }, index) => {
    const solution = solveMounting(definition, geometry);
    const shelfDepthMm = definition.depthMm + SHELF_LIP_MM;
    return {
      instanceId: instance.id,
      solution,
      rearBracketCollides: solution.rearGapMm < 0,
      shelfIntersectsRails: solution.onShelf && shelfDepthMm > spacingMm,
      exceedsRailSpacing: solution.exceedsRailSpacing,
      overlappingInstanceIds: boxes
        .filter(
          (other, otherIndex) =>
            otherIndex !== index &&
            aabbsIntersect(boxes[index].box, other.box),
        )
        .map((other) => other.id),
    };
  });
}

/** Y of the shelf surface top for a device starting at `startU`. */
export const shelfSurfaceY = (
  startU: number,
  geometry: RackGeometry,
): number => geometry.railBaseYM + (startU - 1) * U_METERS + SHELF_THICKNESS_M;
