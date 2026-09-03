import type { RackSize } from '@/types';

/**
 * Production rack profiles. A profile separates the quantities that the
 * previous single-constant rack conflated:
 *
 * - external (enclosure) depth — outermost front-to-back extent
 * - front rail plane — mounting face position, inset from the front face
 * - rear rail plane — front rail plane minus the rail spacing
 * - rail spacing — distance between the two mounting planes
 * - usable device depth — deepest device the rack accepts
 *
 * All values in millimeters.
 */

export type RackProfileId =
  | 'open-frame-600'
  | 'open-frame-700'
  | 'open-frame-800'
  | 'cabinet-42u'
  | 'wall-rack-9u'
  | 'unifi-minirack'
  | 'uacc-wall-12u'
  | 'uacc-wall-12u-solid'
  | 'custom';

export type EnclosureType =
  | 'open-frame'
  | 'cabinet'
  | 'desktop-frame'
  | 'wall-mount';
export type RackBaseType = 'plinth-feet' | 'compact-feet';

export interface RailSpacingRange {
  minMm: number;
  maxMm: number;
  defaultMm: number;
}

export interface RackProfile {
  id: RackProfileId;
  name: string;
  enclosure: EnclosureType;
  /** Rack-unit heights this profile is manufactured in. */
  allowedUnits: readonly RackSize[];
  externalWidthMm: number;
  externalDepthMm: number;
  /** Front rail plane inset from the enclosure front face. */
  frontRailInsetMm: number;
  /** Adjustable rail-to-rail spacing, or null when the rails are fixed. */
  railSpacingRange: RailSpacingRange | null;
  /** Fixed rail spacing when railSpacingRange is null. */
  fixedRailSpacingMm: number;
  /** Deepest mountable device at the default rail configuration. */
  nominalUsableDepthMm: number;
  /** Hard cap on device depth, regardless of rail position. */
  maxDeviceDepthMm: number;
  /** Reserved space behind the rear rail plane (inside the enclosure). */
  rearClearanceMm: number;
  /** Advisory space for cable routing at the rear (future hook). */
  cableClearanceMm: number;
  /** Profile offers rear support rails for heavy chassis. */
  supportRails: boolean;
  /** Profile accepts fixed shelves for non-rack gear. */
  shelfCompatible: boolean;
  loadRatingKg: number;
  baseType: RackBaseType;
  description: string;
}

const ALL_UNITS: readonly RackSize[] = [6, 9, 12, 18, 24, 42];

export const RACK_PROFILES: Record<RackProfileId, RackProfile> = {
  'open-frame-600': {
    id: 'open-frame-600',
    name: 'Open Frame 600',
    enclosure: 'open-frame',
    allowedUnits: ALL_UNITS,
    externalWidthMm: 574.8,
    externalDepthMm: 600,
    frontRailInsetMm: 0,
    railSpacingRange: { minMm: 250, maxMm: 600, defaultMm: 600 },
    fixedRailSpacingMm: 600,
    nominalUsableDepthMm: 600,
    maxDeviceDepthMm: 600,
    rearClearanceMm: 0,
    cableClearanceMm: 60,
    supportRails: false,
    shelfCompatible: true,
    loadRatingKg: 320,
    baseType: 'plinth-feet',
    description: 'Short-depth 4-post frame for network gear.',
  },
  'open-frame-700': {
    id: 'open-frame-700',
    name: 'Open Frame 700',
    enclosure: 'open-frame',
    allowedUnits: ALL_UNITS,
    externalWidthMm: 574.8,
    externalDepthMm: 700,
    frontRailInsetMm: 0,
    railSpacingRange: { minMm: 250, maxMm: 700, defaultMm: 700 },
    fixedRailSpacingMm: 700,
    nominalUsableDepthMm: 700,
    maxDeviceDepthMm: 700,
    rearClearanceMm: 0,
    cableClearanceMm: 80,
    supportRails: false,
    shelfCompatible: true,
    loadRatingKg: 350,
    baseType: 'plinth-feet',
    description: 'General-purpose 4-post open frame.',
  },
  'open-frame-800': {
    id: 'open-frame-800',
    name: 'Open Frame 800',
    enclosure: 'open-frame',
    allowedUnits: ALL_UNITS,
    externalWidthMm: 574.8,
    externalDepthMm: 800,
    frontRailInsetMm: 0,
    railSpacingRange: { minMm: 300, maxMm: 800, defaultMm: 800 },
    fixedRailSpacingMm: 800,
    nominalUsableDepthMm: 800,
    maxDeviceDepthMm: 800,
    rearClearanceMm: 0,
    cableClearanceMm: 100,
    supportRails: true,
    shelfCompatible: true,
    loadRatingKg: 400,
    baseType: 'plinth-feet',
    description: 'Deep 4-post frame for full-depth servers.',
  },
  'cabinet-42u': {
    id: 'cabinet-42u',
    name: '42U Cabinet',
    enclosure: 'cabinet',
    allowedUnits: [42],
    externalWidthMm: 600,
    externalDepthMm: 1000,
    frontRailInsetMm: 100,
    railSpacingRange: { minMm: 250, maxMm: 850, defaultMm: 750 },
    fixedRailSpacingMm: 750,
    nominalUsableDepthMm: 850,
    maxDeviceDepthMm: 850,
    rearClearanceMm: 50,
    cableClearanceMm: 100,
    supportRails: true,
    shelfCompatible: true,
    loadRatingKg: 1000,
    baseType: 'plinth-feet',
    description: 'Full-height enclosure with adjustable inner rails.',
  },
  'wall-rack-9u': {
    id: 'wall-rack-9u',
    name: 'Wall Rack 9U',
    enclosure: 'wall-mount',
    allowedUnits: [6, 9, 12],
    externalWidthMm: 574.8,
    externalDepthMm: 450,
    frontRailInsetMm: 0,
    railSpacingRange: { minMm: 250, maxMm: 450, defaultMm: 450 },
    fixedRailSpacingMm: 450,
    nominalUsableDepthMm: 450,
    maxDeviceDepthMm: 450,
    rearClearanceMm: 0,
    cableClearanceMm: 40,
    supportRails: false,
    shelfCompatible: false,
    loadRatingKg: 60,
    baseType: 'compact-feet',
    description: 'Shallow wall-mount frame for comms closets.',
  },
  'unifi-minirack': {
    id: 'unifi-minirack',
    name: 'Toolless Mini Rack',
    enclosure: 'desktop-frame',
    allowedUnits: [6],
    externalWidthMm: 574.8,
    externalDepthMm: 400,
    frontRailInsetMm: 0,
    railSpacingRange: null,
    fixedRailSpacingMm: 400,
    nominalUsableDepthMm: 400,
    maxDeviceDepthMm: 400,
    rearClearanceMm: 0,
    cableClearanceMm: 30,
    supportRails: false,
    shelfCompatible: true,
    loadRatingKg: 25,
    baseType: 'compact-feet',
    description: 'Desk-friendly 6U frame with fixed toolless rails.',
  },
  'uacc-wall-12u': {
    id: 'uacc-wall-12u',
    name: 'UACC 12U Wall Cabinet',
    enclosure: 'wall-mount',
    allowedUnits: [12],
    externalWidthMm: 600,
    externalDepthMm: 610,
    // Front rail plane inset from the glass door — drives hasInnerRails so
    // devices mount inside the enclosure, aligned to the GLB's rails.
    frontRailInsetMm: 38,
    railSpacingRange: { minMm: 250, maxMm: 500, defaultMm: 450 },
    fixedRailSpacingMm: 450,
    nominalUsableDepthMm: 450,
    maxDeviceDepthMm: 500,
    rearClearanceMm: 50,
    cableClearanceMm: 60,
    supportRails: true,
    shelfCompatible: true,
    loadRatingKg: 45,
    baseType: 'compact-feet',
    description:
      'Interactive 12U 600mm wall-mount cabinet: hinged glass door, removable side panels and covers.',
  },
  'uacc-wall-12u-solid': {
    id: 'uacc-wall-12u-solid',
    name: 'UACC 12U Wall Cabinet (Realistic)',
    enclosure: 'wall-mount',
    allowedUnits: [12],
    externalWidthMm: 600,
    externalDepthMm: 610,
    // Same mounting geometry as the interactive profile so devices seat
    // identically inside the shell; this variant swaps the 123-part model
    // for the accurate one-piece manufacturer mesh (no moving parts).
    frontRailInsetMm: 38,
    railSpacingRange: { minMm: 250, maxMm: 500, defaultMm: 450 },
    fixedRailSpacingMm: 450,
    nominalUsableDepthMm: 450,
    maxDeviceDepthMm: 500,
    rearClearanceMm: 50,
    cableClearanceMm: 60,
    supportRails: true,
    shelfCompatible: true,
    loadRatingKg: 45,
    baseType: 'compact-feet',
    description:
      'Photoreal 12U 600mm wall cabinet — the accurate one-piece model. Fixed glass door (no open/remove interactions).',
  },
  custom: {
    id: 'custom',
    name: 'Custom Rack',
    enclosure: 'open-frame',
    allowedUnits: ALL_UNITS,
    externalWidthMm: 574.8,
    externalDepthMm: 750,
    frontRailInsetMm: 0,
    railSpacingRange: { minMm: 250, maxMm: 900, defaultMm: 750 },
    fixedRailSpacingMm: 750,
    nominalUsableDepthMm: 750,
    maxDeviceDepthMm: 900,
    rearClearanceMm: 0,
    cableClearanceMm: 80,
    supportRails: true,
    shelfCompatible: true,
    loadRatingKg: 500,
    baseType: 'plinth-feet',
    description: 'Fully adjustable frame for special builds.',
  },
};

export const DEFAULT_PROFILE_ID: RackProfileId = 'open-frame-700';

export const getProfile = (id: RackProfileId): RackProfile =>
  RACK_PROFILES[id];

/** Default rail spacing for a profile (range default or fixed value). */
export const defaultRailSpacingMm = (profile: RackProfile): number =>
  profile.railSpacingRange?.defaultMm ?? profile.fixedRailSpacingMm;

/** Clamp a requested rail spacing to the profile's supported range. */
export function clampRailSpacingMm(
  profile: RackProfile,
  spacingMm: number,
): number {
  const range = profile.railSpacingRange;
  if (!range) return profile.fixedRailSpacingMm;
  return Math.min(range.maxMm, Math.max(range.minMm, Math.round(spacingMm)));
}
