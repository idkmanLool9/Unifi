import type { RackOrientation } from '@/types';

/**
 * The device-definition format: every rack device — built-in or loaded
 * from /devices/<manufacturer>/<slug>/metadata.json — is described by
 * metadata, never by bespoke component logic. All physical values are in
 * millimeters / kilograms / watts; the 3D layer converts to meters.
 */

export const DEVICE_CATEGORIES = [
  'routing',
  'switching',
  'servers',
  'storage',
  'power',
  'accessories',
] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const MOUNTING_STANDARDS = ['eia-310', 'none'] as const;
export type MountingStandard = (typeof MOUNTING_STANDARDS)[number];

/** Procedural thumbnail styles (used until thumbnail.webp exists). */
export const FACEPLATE_STYLES = [
  'network',
  'server',
  'storage',
  'ups',
  'pdu',
] as const;
export type FaceplateStyle = (typeof FACEPLATE_STYLES)[number];

export const PORT_TYPES = [
  'rj45',
  'sfp',
  'sfp+',
  'sfp28',
  'qsfp+',
  'qsfp28',
  'power',
  'usb',
  'console',
  'other',
] as const;
export type PortType = (typeof PORT_TYPES)[number];

/** Future cable-routing hook: a physical port on the device faceplate. */
export interface PortDefinition {
  id: string;
  type: PortType;
  label?: string;
  /** Count of identical ports in this group. */
  count: number;
  /** Optional position of the group's first port, mm from faceplate center. */
  positionMm?: [number, number, number];
}

/** Future status-visualization hook. */
export interface LedDefinition {
  id: string;
  label: string;
  color?: string;
  positionMm?: [number, number, number];
}

/** Corrections applied to the loaded GLB — metadata is the source of truth. */
export interface ModelTransform {
  /** Uniform scale, or per-axis [x, y, z] when a source model's axes were
   *  exported at inconsistent units. */
  scale: number | [number, number, number];
  rotationDeg: [number, number, number];
  offsetMm: [number, number, number];
}

export interface DevicePresentation {
  faceplate: FaceplateStyle;
  tone: 'dark' | 'metal';
  badge?: 'popular' | 'new';
  portsLabel?: string;
  speedLabel?: string;
  poe?: boolean;
}

export interface DeviceDefinition {
  id: string;
  /** Asset folder name under /devices/<manufacturer>/. */
  slug: string;
  manufacturer: string;
  manufacturerName: string;
  productName: string;
  modelNumber: string;
  category: DeviceCategory;
  rackUnits: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  weightKg: number;
  mountingStandard: MountingStandard;
  /** Explicit asset paths; when absent they derive from manufacturer/slug. */
  frontModelPath?: string;
  thumbnailPath?: string;
  defaultFacing: RackOrientation;
  powerConsumptionWatts: number;
  maximumPowerWatts: number;
  tags: string[];
  description: string;
  modelTransform: ModelTransform;
  /** Vertical trim from the U boundary, in millimeters. */
  mountingOffsetMm: number;
  ports: PortDefinition[];
  leds: LedDefinition[];
  presentation: DevicePresentation;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  path: string;
  message: string;
}

export type DefinitionResult =
  | { ok: true; value: DeviceDefinition }
  | { ok: false; issues: ValidationIssue[] };

const MAX_RACK_UNITS = 48;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

class Checker {
  issues: ValidationIssue[] = [];

  fail(path: string, message: string): undefined {
    this.issues.push({ path, message });
    return undefined;
  }

  string(source: Record<string, unknown>, path: string): string | undefined {
    const value = source[path];
    if (typeof value !== 'string' || value.trim() === '') {
      return this.fail(path, 'must be a non-empty string');
    }
    return value;
  }

  optionalString(
    source: Record<string, unknown>,
    path: string,
  ): string | undefined {
    const value = source[path];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.trim() === '') {
      return this.fail(path, 'must be a non-empty string when present');
    }
    return value;
  }

  number(
    source: Record<string, unknown>,
    path: string,
    opts: { min?: number; max?: number; integer?: boolean } = {},
  ): number | undefined {
    const value = source[path];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return this.fail(path, 'must be a finite number');
    }
    if (opts.integer && !Number.isInteger(value)) {
      return this.fail(path, 'must be an integer');
    }
    if (opts.min !== undefined && value < opts.min) {
      return this.fail(path, `must be ≥ ${opts.min}`);
    }
    if (opts.max !== undefined && value > opts.max) {
      return this.fail(path, `must be ≤ ${opts.max}`);
    }
    return value;
  }

  oneOf<T extends string>(
    source: Record<string, unknown>,
    path: string,
    allowed: readonly T[],
    fallback?: T,
  ): T | undefined {
    const value = source[path];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
    return this.fail(path, `must be one of: ${allowed.join(', ')}`);
  }
}

function parseModelTransform(
  input: unknown,
  checker: Checker,
): ModelTransform {
  const fallback: ModelTransform = {
    scale: 1,
    rotationDeg: [0, 0, 0],
    offsetMm: [0, 0, 0],
  };
  if (input === undefined) return fallback;
  if (!isRecord(input)) {
    checker.fail('modelTransform', 'must be an object');
    return fallback;
  }
  const isPositive = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n > 0;
  const scale =
    input.scale === undefined
      ? 1
      : isPositive(input.scale)
        ? input.scale
        : Array.isArray(input.scale) &&
            input.scale.length === 3 &&
            input.scale.every(isPositive)
          ? (input.scale as [number, number, number])
          : checker.fail(
              'modelTransform.scale',
              'must be a positive number or [x, y, z] of positive numbers',
            );
  const rotationDeg =
    input.rotationDeg === undefined
      ? ([0, 0, 0] as [number, number, number])
      : isVec3(input.rotationDeg)
        ? input.rotationDeg
        : checker.fail('modelTransform.rotationDeg', 'must be [x, y, z] numbers');
  const offsetMm =
    input.offsetMm === undefined
      ? ([0, 0, 0] as [number, number, number])
      : isVec3(input.offsetMm)
        ? input.offsetMm
        : checker.fail('modelTransform.offsetMm', 'must be [x, y, z] numbers');
  return {
    scale: scale ?? 1,
    rotationDeg: rotationDeg ?? [0, 0, 0],
    offsetMm: offsetMm ?? [0, 0, 0],
  };
}

function parsePorts(input: unknown, checker: Checker): PortDefinition[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    checker.fail('ports', 'must be an array');
    return [];
  }
  const ports: PortDefinition[] = [];
  input.forEach((entry, i) => {
    if (!isRecord(entry)) {
      checker.fail(`ports[${i}]`, 'must be an object');
      return;
    }
    const sub = new Checker();
    const id = sub.string(entry, 'id');
    const type = sub.oneOf(entry, 'type', PORT_TYPES);
    const count = sub.number(entry, 'count', { min: 1, integer: true });
    const label = sub.optionalString(entry, 'label');
    const positionMm =
      entry.positionMm === undefined
        ? undefined
        : isVec3(entry.positionMm)
          ? entry.positionMm
          : sub.fail('positionMm', 'must be [x, y, z] numbers');
    sub.issues.forEach(({ path, message }) =>
      checker.fail(`ports[${i}].${path}`, message),
    );
    if (id && type && count !== undefined) {
      ports.push({ id, type, count, label, positionMm });
    }
  });
  return ports;
}

function parseLeds(input: unknown, checker: Checker): LedDefinition[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    checker.fail('leds', 'must be an array');
    return [];
  }
  const leds: LedDefinition[] = [];
  input.forEach((entry, i) => {
    if (!isRecord(entry)) {
      checker.fail(`leds[${i}]`, 'must be an object');
      return;
    }
    const sub = new Checker();
    const id = sub.string(entry, 'id');
    const label = sub.string(entry, 'label');
    const color = sub.optionalString(entry, 'color');
    const positionMm =
      entry.positionMm === undefined
        ? undefined
        : isVec3(entry.positionMm)
          ? entry.positionMm
          : sub.fail('positionMm', 'must be [x, y, z] numbers');
    sub.issues.forEach(({ path, message }) =>
      checker.fail(`leds[${i}].${path}`, message),
    );
    if (id && label) leds.push({ id, label, color, positionMm });
  });
  return leds;
}

function parsePresentation(
  input: unknown,
  checker: Checker,
): DevicePresentation {
  const fallback: DevicePresentation = { faceplate: 'server', tone: 'dark' };
  if (input === undefined) return fallback;
  if (!isRecord(input)) {
    checker.fail('presentation', 'must be an object');
    return fallback;
  }
  const sub = new Checker();
  const faceplate = sub.oneOf(input, 'faceplate', FACEPLATE_STYLES, 'server');
  const tone = sub.oneOf(input, 'tone', ['dark', 'metal'] as const, 'dark');
  const badge =
    input.badge === undefined
      ? undefined
      : sub.oneOf(input, 'badge', ['popular', 'new'] as const);
  const portsLabel = sub.optionalString(input, 'portsLabel');
  const speedLabel = sub.optionalString(input, 'speedLabel');
  const poe =
    input.poe === undefined
      ? undefined
      : typeof input.poe === 'boolean'
        ? input.poe
        : sub.fail('poe', 'must be a boolean');
  sub.issues.forEach(({ path, message }) =>
    checker.fail(`presentation.${path}`, message),
  );
  return {
    faceplate: faceplate ?? 'server',
    tone: tone ?? 'dark',
    badge,
    portsLabel,
    speedLabel,
    poe,
  };
}

/**
 * Validates unknown input (e.g. a fetched metadata.json) into a complete
 * DeviceDefinition, applying documented defaults for optional fields.
 */
export function validateDeviceDefinition(input: unknown): DefinitionResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'definition must be an object' }],
    };
  }

  const c = new Checker();

  const id = c.string(input, 'id');
  const slug = c.string(input, 'slug');
  const manufacturer = c.string(input, 'manufacturer');
  const manufacturerName = c.string(input, 'manufacturerName');
  const productName = c.string(input, 'productName');
  const modelNumber = c.string(input, 'modelNumber');
  const category = c.oneOf(input, 'category', DEVICE_CATEGORIES);
  const rackUnits = c.number(input, 'rackUnits', {
    min: 1,
    max: MAX_RACK_UNITS,
    integer: true,
  });
  const widthMm = c.number(input, 'widthMm', { min: 1 });
  const heightMm = c.number(input, 'heightMm', { min: 1 });
  const depthMm = c.number(input, 'depthMm', { min: 1 });
  const weightKg = c.number(input, 'weightKg', { min: 0 });
  const mountingStandard = c.oneOf(
    input,
    'mountingStandard',
    MOUNTING_STANDARDS,
    'eia-310',
  );
  const defaultFacing = c.oneOf(
    input,
    'defaultFacing',
    ['front', 'rear'] as const,
    'front',
  );
  const powerConsumptionWatts = c.number(input, 'powerConsumptionWatts', {
    min: 0,
  });
  const maximumPowerWatts = c.number(input, 'maximumPowerWatts', { min: 0 });
  const description = c.string(input, 'description');
  const frontModelPath = c.optionalString(input, 'frontModelPath');
  const thumbnailPath = c.optionalString(input, 'thumbnailPath');
  const mountingOffsetMm =
    input.mountingOffsetMm === undefined
      ? 0
      : (c.number(input, 'mountingOffsetMm', { min: -10, max: 10 }) ?? 0);

  let tags: string[] = [];
  if (input.tags !== undefined) {
    if (
      Array.isArray(input.tags) &&
      input.tags.every((t): t is string => typeof t === 'string')
    ) {
      tags = input.tags;
    } else {
      c.fail('tags', 'must be an array of strings');
    }
  }

  const modelTransform = parseModelTransform(input.modelTransform, c);
  const ports = parsePorts(input.ports, c);
  const leds = parseLeds(input.leds, c);
  const presentation = parsePresentation(input.presentation, c);

  if (c.issues.length > 0) return { ok: false, issues: c.issues };

  // The checks above guarantee these are defined; assemble the definition.
  return {
    ok: true,
    value: {
      id: id!,
      slug: slug!,
      manufacturer: manufacturer!,
      manufacturerName: manufacturerName!,
      productName: productName!,
      modelNumber: modelNumber!,
      category: category!,
      rackUnits: rackUnits!,
      widthMm: widthMm!,
      heightMm: heightMm!,
      depthMm: depthMm!,
      weightKg: weightKg!,
      mountingStandard: mountingStandard!,
      frontModelPath,
      thumbnailPath,
      defaultFacing: defaultFacing!,
      powerConsumptionWatts: powerConsumptionWatts!,
      maximumPowerWatts: maximumPowerWatts!,
      tags,
      description: description!,
      modelTransform,
      mountingOffsetMm,
      ports,
      leds,
      presentation,
    },
  };
}
