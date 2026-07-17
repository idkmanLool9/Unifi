import type { PhysicalConnectorType } from '@/features/devices/hardware/physicalPorts';

/**
 * The cable catalog: every cable type RackForge can plan with, described
 * as data. Compatibility, bend radii, standard lengths, and visual
 * properties all live here — never hardcoded in UI components.
 */

export const CABLE_TYPES = [
  'cat5e',
  'cat6',
  'cat6a',
  'cat7',
  'cat8',
  'dac',
  'aoc',
  'fiber-sm',
  'fiber-mm',
  'power-c13',
  'power-c19',
  'power-dc',
  'usb',
  'console',
  'serial',
  'custom',
] as const;
export type CableTypeId = (typeof CABLE_TYPES)[number];

export type CableCategory = 'copper' | 'fiber' | 'dac' | 'power' | 'peripheral';
export type CableCarries = 'data' | 'power' | 'both';

/** Fiber termination variants (metadata; MPO for future breakouts). */
export const FIBER_CONNECTORS = ['lc-lc', 'lc-sc', 'mpo'] as const;
export type FiberConnector = (typeof FIBER_CONNECTORS)[number];

export interface CableTypeSpec {
  id: CableTypeId;
  name: string;
  category: CableCategory;
  /** Port types this cable can terminate on (both ends). */
  compatiblePorts: readonly PhysicalConnectorType[];
  /** Highest link speed the cable supports, Gbps (data cables). */
  maxSpeedGbps?: number;
  carries: CableCarries;
  /** Plug orientation matters (e.g. power source → inlet). */
  directional: boolean;
  diameterMm: number;
  minBendRadiusMm: number;
  standardLengthsMm: readonly number[];
  /** Default sheath color (palette id or hex). */
  defaultColor: string;
  /** Default surface response: cloth-like copper vs glossy fiber. */
  roughness: number;
  /** Available fiber terminations (fiber types only). */
  fiberConnectors?: readonly FiberConnector[];
  /** Cable can deliver PoE to a powered port. */
  poeCapable?: boolean;
  /**
   * Sheath stiffness 0..1. Stiff cables (DAC, power) hold wider bends
   * than their minimum radius; limp fiber follows the route tightly.
   * Drives the fillet radius: r = minBend × (1 + stiffness).
   */
  stiffness: number;
  /** Largest single direction change the sheath tolerates, degrees. */
  maxBendAngleDeg: number;
  /** Tube cross-section resolution (radial segments). */
  radialSegments: number;
  /** Sheath metalness (braided DAC reads metallic, PVC doesn't). */
  metalness?: number;
}

const COPPER_LENGTHS = [250, 500, 1000, 2000, 3000, 5000, 10000] as const;
const FIBER_LENGTHS = [500, 1000, 2000, 3000, 5000, 10000, 15000] as const;
const DAC_LENGTHS = [500, 1000, 2000, 3000, 5000] as const;
const POWER_LENGTHS = [600, 1000, 1800, 2500] as const;

const COPPER_PORTS = ['rj45', 'keystone', 'poe-in'] as const;
const SFP_PORTS = ['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28'] as const;
const IEC_13_PORTS = ['c14', 'power', 'iec-lock'] as const;

export const CABLE_CATALOG: Record<CableTypeId, CableTypeSpec> = {
  cat5e: {
    id: 'cat5e',
    name: 'Cat5e U/UTP',
    category: 'copper',
    compatiblePorts: COPPER_PORTS,
    maxSpeedGbps: 1,
    carries: 'data',
    directional: false,
    diameterMm: 5,
    minBendRadiusMm: 25,
    standardLengthsMm: COPPER_LENGTHS,
    defaultColor: '#5a83e0',
    roughness: 0.72,
    poeCapable: true,
    stiffness: 0.35,
    maxBendAngleDeg: 100,
    radialSegments: 12,
  },
  cat6: {
    id: 'cat6',
    name: 'Cat6 U/UTP',
    category: 'copper',
    compatiblePorts: COPPER_PORTS,
    maxSpeedGbps: 2.5,
    carries: 'data',
    directional: false,
    diameterMm: 5.5,
    minBendRadiusMm: 25,
    standardLengthsMm: COPPER_LENGTHS,
    defaultColor: '#5a83e0',
    roughness: 0.72,
    poeCapable: true,
    stiffness: 0.4,
    maxBendAngleDeg: 100,
    radialSegments: 12,
  },
  cat6a: {
    id: 'cat6a',
    name: 'Cat6A S/FTP',
    category: 'copper',
    compatiblePorts: COPPER_PORTS,
    maxSpeedGbps: 10,
    carries: 'data',
    directional: false,
    diameterMm: 6.5,
    minBendRadiusMm: 30,
    standardLengthsMm: COPPER_LENGTHS,
    defaultColor: '#5a83e0',
    roughness: 0.7,
    poeCapable: true,
    stiffness: 0.45,
    maxBendAngleDeg: 95,
    radialSegments: 12,
  },
  cat7: {
    id: 'cat7',
    name: 'Cat7 S/FTP',
    category: 'copper',
    compatiblePorts: COPPER_PORTS,
    maxSpeedGbps: 10,
    carries: 'data',
    directional: false,
    diameterMm: 7,
    minBendRadiusMm: 35,
    standardLengthsMm: COPPER_LENGTHS,
    defaultColor: '#5a83e0',
    roughness: 0.7,
    poeCapable: true,
    stiffness: 0.5,
    maxBendAngleDeg: 90,
    radialSegments: 12,
  },
  cat8: {
    id: 'cat8',
    name: 'Cat8 S/FTP',
    category: 'copper',
    compatiblePorts: COPPER_PORTS,
    maxSpeedGbps: 40,
    carries: 'data',
    directional: false,
    diameterMm: 8,
    minBendRadiusMm: 40,
    standardLengthsMm: [250, 500, 1000, 2000, 3000],
    defaultColor: '#8a8f99',
    roughness: 0.66,
    poeCapable: true,
    stiffness: 0.6,
    maxBendAngleDeg: 85,
    radialSegments: 14,
  },
  dac: {
    id: 'dac',
    name: 'DAC (Twinax)',
    category: 'dac',
    compatiblePorts: SFP_PORTS,
    maxSpeedGbps: 100,
    carries: 'data',
    directional: false,
    diameterMm: 6,
    minBendRadiusMm: 40,
    standardLengthsMm: DAC_LENGTHS,
    defaultColor: '#3a3f46',
    roughness: 0.55,
    stiffness: 0.8,
    maxBendAngleDeg: 75,
    radialSegments: 12,
    metalness: 0.35,
  },
  aoc: {
    id: 'aoc',
    name: 'AOC (Active Optical)',
    category: 'dac',
    compatiblePorts: SFP_PORTS,
    maxSpeedGbps: 100,
    carries: 'data',
    directional: false,
    diameterMm: 3.5,
    minBendRadiusMm: 20,
    standardLengthsMm: FIBER_LENGTHS,
    defaultColor: '#22c1a4',
    roughness: 0.45,
    stiffness: 0.25,
    maxBendAngleDeg: 110,
    radialSegments: 10,
  },
  'fiber-sm': {
    id: 'fiber-sm',
    name: 'Single-mode fiber (OS2)',
    category: 'fiber',
    compatiblePorts: SFP_PORTS,
    maxSpeedGbps: 400,
    carries: 'data',
    directional: false,
    diameterMm: 2.8,
    minBendRadiusMm: 15,
    standardLengthsMm: FIBER_LENGTHS,
    defaultColor: '#e8d44d',
    roughness: 0.4,
    fiberConnectors: FIBER_CONNECTORS,
    stiffness: 0.15,
    maxBendAngleDeg: 120,
    radialSegments: 10,
  },
  'fiber-mm': {
    id: 'fiber-mm',
    name: 'Multi-mode fiber (OM4)',
    category: 'fiber',
    compatiblePorts: SFP_PORTS,
    maxSpeedGbps: 100,
    carries: 'data',
    directional: false,
    diameterMm: 2.8,
    minBendRadiusMm: 15,
    standardLengthsMm: FIBER_LENGTHS,
    defaultColor: '#39c1d4',
    roughness: 0.4,
    fiberConnectors: FIBER_CONNECTORS,
    stiffness: 0.15,
    maxBendAngleDeg: 120,
    radialSegments: 10,
  },
  'power-c13': {
    id: 'power-c13',
    name: 'IEC C13–C14',
    category: 'power',
    compatiblePorts: IEC_13_PORTS,
    carries: 'power',
    directional: true,
    diameterMm: 8,
    minBendRadiusMm: 50,
    standardLengthsMm: POWER_LENGTHS,
    defaultColor: '#23262b',
    roughness: 0.62,
    stiffness: 0.7,
    maxBendAngleDeg: 80,
    radialSegments: 14,
  },
  'power-c19': {
    id: 'power-c19',
    name: 'IEC C19–C20',
    category: 'power',
    compatiblePorts: ['c20'],
    carries: 'power',
    directional: true,
    diameterMm: 10,
    minBendRadiusMm: 60,
    standardLengthsMm: POWER_LENGTHS,
    defaultColor: '#23262b',
    roughness: 0.62,
    stiffness: 0.75,
    maxBendAngleDeg: 75,
    radialSegments: 14,
  },
  'power-dc': {
    id: 'power-dc',
    name: 'DC power',
    category: 'power',
    compatiblePorts: ['dc', 'external-adapter'],
    carries: 'power',
    directional: true,
    diameterMm: 5,
    minBendRadiusMm: 30,
    standardLengthsMm: POWER_LENGTHS,
    defaultColor: '#23262b',
    roughness: 0.62,
    stiffness: 0.5,
    maxBendAngleDeg: 90,
    radialSegments: 12,
  },
  usb: {
    id: 'usb',
    name: 'USB',
    category: 'peripheral',
    compatiblePorts: ['usb', 'usb-a', 'usb-c'],
    maxSpeedGbps: 10,
    carries: 'both',
    directional: true,
    diameterMm: 4.5,
    minBendRadiusMm: 20,
    standardLengthsMm: [500, 1000, 2000, 3000],
    defaultColor: '#3a3f46',
    roughness: 0.6,
    stiffness: 0.4,
    maxBendAngleDeg: 100,
    radialSegments: 12,
  },
  console: {
    id: 'console',
    name: 'Console (rollover)',
    category: 'peripheral',
    compatiblePorts: ['console', 'rj45', 'usb', 'usb-a', 'usb-c'],
    carries: 'data',
    directional: false,
    diameterMm: 5,
    minBendRadiusMm: 25,
    standardLengthsMm: [1000, 2000, 3000],
    defaultColor: '#57c1e8',
    roughness: 0.7,
    stiffness: 0.3,
    maxBendAngleDeg: 110,
    radialSegments: 12,
  },
  serial: {
    id: 'serial',
    name: 'Serial (DB9)',
    category: 'peripheral',
    compatiblePorts: ['serial'],
    carries: 'data',
    directional: true,
    diameterMm: 6,
    minBendRadiusMm: 35,
    standardLengthsMm: [1000, 2000, 3000],
    defaultColor: '#8a8f99',
    roughness: 0.65,
    stiffness: 0.6,
    maxBendAngleDeg: 80,
    radialSegments: 12,
  },
  custom: {
    id: 'custom',
    name: 'Custom cable',
    category: 'peripheral',
    compatiblePorts: ['other'],
    carries: 'both',
    directional: false,
    diameterMm: 6,
    minBendRadiusMm: 30,
    standardLengthsMm: COPPER_LENGTHS,
    defaultColor: '#8a8f99',
    roughness: 0.6,
    stiffness: 0.4,
    maxBendAngleDeg: 100,
    radialSegments: 12,
  },
};

/**
 * Professional sheath palette. Names describe common uses; nothing in
 * the engine attaches semantics to a color.
 */
export const CABLE_PALETTE = [
  { id: 'lan-blue', name: 'Blue', hex: '#5a83e0' },
  { id: 'wan-amber', name: 'Amber', hex: '#e0a23f' },
  { id: 'mgmt-violet', name: 'Violet', hex: '#8f6fe8' },
  { id: 'voice-green', name: 'Green', hex: '#4fae6b' },
  { id: 'storage-teal', name: 'Teal', hex: '#33b3a6' },
  { id: 'uplink-red', name: 'Red', hex: '#d4574e' },
  { id: 'fiber-yellow', name: 'OS2 yellow', hex: '#e8d44d' },
  { id: 'fiber-aqua', name: 'OM4 aqua', hex: '#39c1d4' },
  { id: 'neutral-gray', name: 'Gray', hex: '#8a8f99' },
  { id: 'power-black', name: 'Black', hex: '#23262b' },
  { id: 'white', name: 'White', hex: '#d9dce1' },
] as const;

/** Cable types that can terminate on a given port type. */
export const cableTypesForPort = (
  portType: PhysicalConnectorType,
): CableTypeSpec[] =>
  Object.values(CABLE_CATALOG).filter((spec) =>
    spec.compatiblePorts.includes(portType),
  );

/** Cable types usable between two port types (both ends compatible). */
export const cableTypesBetween = (
  a: PhysicalConnectorType,
  b: PhysicalConnectorType,
): CableTypeSpec[] =>
  cableTypesForPort(a).filter((spec) => spec.compatiblePorts.includes(b));

/**
 * Deterministic default cable for a port pair, honoring link speed:
 * the slowest cable that still carries the faster port (never a cable
 * slower than the link when a faster one exists).
 */
export function defaultCableType(
  a: { type: PhysicalConnectorType; speedGbps?: number },
  b: { type: PhysicalConnectorType; speedGbps?: number },
): CableTypeSpec | null {
  const candidates = cableTypesBetween(a.type, b.type);
  if (candidates.length === 0) return null;
  const linkSpeed = Math.max(a.speedGbps ?? 0, b.speedGbps ?? 0);
  const fastEnough = candidates
    .filter((c) => (c.maxSpeedGbps ?? Infinity) >= linkSpeed)
    .sort((x, y) => (x.maxSpeedGbps ?? Infinity) - (y.maxSpeedGbps ?? Infinity));
  return fastEnough[0] ?? candidates[candidates.length - 1];
}
