import type { RackFinishId, RackSize } from '@/types';

/** One rack unit in meters (EIA-310: 1U = 1.75in = 44.45mm). */
export const U_METERS = 0.04445;

export const RACK_SIZES: readonly RackSize[] = [6, 9, 12, 18, 24, 42];

/** Open-frame rack dimensions in meters, based on a 19in EIA-310 frame. */
export const RACK_DIMS = {
  /** Clear opening between the mounting flanges (450.8mm). */
  opening: 0.4508,
  /** Width of each upright column (x). */
  uprightW: 0.062,
  /** Depth of each upright column (z). */
  uprightD: 0.034,
  /** Thickness of the mounting flange (front plate of the L-profile). */
  flangeD: 0.012,
  /** Thickness of the L-profile web (side plate running rearward). */
  webT: 0.012,
  /** How far the web extends behind the flange. */
  webD: 0.06,
  /** Front-to-rear upright spacing, center to center. */
  depth: 0.7,
  /** Height of the base plinth. */
  baseH: 0.075,
  /** Leveling feet height. */
  feetH: 0.015,
  /** Top frame beam thickness. */
  topH: 0.035,
} as const;

/** Overall frame width (opening + two uprights). */
export const rackOuterWidth = (): number =>
  RACK_DIMS.opening + 2 * RACK_DIMS.uprightW;

/** Overall footprint depth including upright columns. */
export const rackOuterDepth = (): number =>
  RACK_DIMS.depth + RACK_DIMS.uprightD;

/** Y position where the rails (U1) begin. */
export const railBaseY = (): number => RACK_DIMS.feetH + RACK_DIMS.baseH;

/** Total rail height for a rack size. */
export const railHeight = (units: RackSize): number => units * U_METERS;

/** Overall rack height, floor to top of frame. */
export const rackHeight = (units: RackSize): number =>
  railBaseY() + railHeight(units) + RACK_DIMS.topH;

export interface RackFinish {
  id: RackFinishId;
  label: string;
  /** True for powder-coated paint, false for bare metal. */
  painted: boolean;
  /** Structural frame color (beams, base). */
  frame: string;
  /** Upright / rail color. */
  upright: string;
  /** Unit-number and tick ink drawn into the rail texture. */
  ink: string;
  /** Mounting-hole color drawn into the rail texture. */
  hole: string;
  /** Swatch color for the inspector picker. */
  swatch: string;
}

export const RACK_FINISHES: Record<RackFinishId, RackFinish> = {
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    painted: true,
    frame: '#2e3136',
    upright: '#3c4046',
    ink: 'rgba(255, 255, 255, 0.6)',
    hole: '#101114',
    swatch: '#34383e',
  },
  steel: {
    id: 'steel',
    label: 'Steel',
    painted: false,
    frame: '#9aa1a9',
    upright: '#bfc5cc',
    ink: 'rgba(22, 26, 32, 0.62)',
    hole: '#4e555e',
    swatch: '#b4bac2',
  },
  sand: {
    id: 'sand',
    label: 'Sand',
    painted: true,
    frame: '#c9c5bb',
    upright: '#e2dfd7',
    ink: 'rgba(48, 46, 40, 0.58)',
    hole: '#787569',
    swatch: '#dcd8cf',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    painted: true,
    frame: '#232b3d',
    upright: '#2e384c',
    ink: 'rgba(186, 202, 235, 0.6)',
    hole: '#0d1119',
    swatch: '#2a3448',
  },
};
