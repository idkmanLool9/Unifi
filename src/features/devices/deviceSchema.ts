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
  'keystone',
  'sfp',
  'sfp+',
  'sfp28',
  'qsfp+',
  'qsfp28',
  'usb',
  'usb-a',
  'usb-c',
  'hdmi',
  'displayport',
  'audio',
  'fiber-lc',
  'phoenix',
  'console',
  'serial',
  'power',
  'dc',
  'c14',
  'c20',
  'other',
] as const;
export type PortType = (typeof PORT_TYPES)[number];

export const PORT_LOCATIONS = ['front', 'rear'] as const;
export type PortLocation = (typeof PORT_LOCATIONS)[number];

/**
 * A group of identical physical ports. Groups are expanded by
 * resolvePhysicalPorts() into individual addressable connectors with
 * stable ids — the anchor points future cable routing terminates on.
 */
export interface PortDefinition {
  id: string;
  type: PortType;
  label?: string;
  /** Which panel the group lives on (front when omitted). */
  location?: PortLocation;
  /** Count of identical ports in this group. */
  count: number;
  /** Optional position of the group's first port, mm from faceplate center. */
  positionMm?: [number, number, number];
  /** Center-to-center spacing between ports in this group, mm. */
  pitchMm?: number;
  /** Front-panel row index (0 = top) for multi-row port blocks. */
  row?: number;
  /** Extra rotation of the connector around its face normal, degrees. */
  rotationDeg?: [number, number, number];
  /** Rendered (true when omitted); hidden ports stay addressable. */
  visible?: boolean;
  /** Negotiated-link speed class of this group, in Gbps. */
  speedGbps?: number;
  /** Group supplies PoE. */
  poe?: boolean;
  /** PoE power budget shared by this group, watts. */
  poeBudgetW?: number;
  /** Ports in this group carry an Etherlighting RGB ring. */
  etherlighting?: boolean;
  /** Cable anchor offset from the port center, mm (future routing). */
  anchorMm?: [number, number, number];
  /**
   * Authored interaction bounds: visible opening width × height, mm.
   * Overrides the connector catalog size (calibration still wins when a
   * GLB carries detectable connector geometry).
   */
  sizeMm?: [number, number];
  /**
   * How deep a plugged connector's nose sits inside the opening, mm
   * (cable renderer; catalog default per connector type when omitted).
   */
  insertionMm?: number;
  /**
   * Authored cable exit direction in device-local space (normalized on
   * use). Default: straight out of the panel face. Lets angled or
   * recessed connectors route cables correctly.
   */
  exitDirMm?: [number, number, number];
  /** Preferred cable bend radius leaving this port, mm. */
  bendRadiusMm?: number;
}

export const LED_KINDS = [
  'power',
  'status',
  'link',
  'activity',
  'poe',
  'fan',
  'temperature',
  'warning',
  'fault',
  'ha',
  'cloud',
  'other',
] as const;
export type LedKind = (typeof LED_KINDS)[number];

export const LED_STATES = ['on', 'off'] as const;
export type LedState = (typeof LED_STATES)[number];

/** A physical indicator LED (rendered emissive; never a real light). */
export interface LedDefinition {
  id: string;
  label: string;
  kind?: LedKind;
  color?: string;
  positionMm?: [number, number, number];
  /** Lens diameter, mm (default 2). */
  diameterMm?: number;
  /** Emissive intensity multiplier (default 1). */
  intensity?: number;
  /** Rendered state (default on). Future animation hooks build on this. */
  state?: LedState;
}

export const LIGHTING_MODES = [
  'off',
  'static',
  'pulse',
  'blink',
  'activity',
  'wave',
] as const;
export type LightingMode = (typeof LIGHTING_MODES)[number];

/**
 * Device lighting capabilities — drives the Etherlighting renderer:
 * per-port illumination rings, speed-class colors, PoE indication and
 * animation modes. Data only; the renderer interprets it, and future
 * link-state simulation plugs in without schema changes.
 */
export interface LightingCapabilities {
  /** RGB illumination ring around every Etherlighting-flagged RJ45 port. */
  etherlighting: boolean;
  /** Individual link/activity LED per port. */
  perPortLink: boolean;
  /** PoE delivery indication per powered port. */
  poeIndicator: boolean;
  /** Link-speed color mapping, keyed by speed class (e.g. '1g', '2.5g'). */
  speedColors: Record<string, string>;
  /** Accent used when a port is selected in the UI. */
  portHighlightColor?: string;
  /** Primary device status LED. */
  statusLed?: { color: string; positionMm?: [number, number, number] };
  /** Rendered animation mode ('static' when omitted; 'off' disables). */
  defaultMode?: LightingMode;
  /** Overall brightness multiplier 0–1 (default 1). */
  brightness?: number;
  /** Identifiers of future animated effects (not implemented yet). */
  effects: string[];
}

/** Corrections applied to the loaded GLB — metadata is the source of truth. */
export interface ModelTransform {
  /** Uniform scale, or per-axis [x, y, z] when a source model's axes were
   *  exported at inconsistent units. */
  scale: number | [number, number, number];
  rotationDeg: [number, number, number];
  offsetMm: [number, number, number];
}

/* ---- Capability metadata (declarative only — no behavior yet) ------- */

export const POWER_CONNECTOR_TYPES = [
  'c14',
  'c20',
  'iec-lock',
  'nema',
  'dc',
  'poe-in',
  'external-adapter',
  'other',
] as const;
export type PowerConnectorType = (typeof POWER_CONNECTOR_TYPES)[number];

/** A power inlet/outlet on the chassis (future power-planning hook). */
export interface PowerConnector {
  id: string;
  type: PowerConnectorType;
  count: number;
  location?: PortLocation;
  label?: string;
  /** Position of the first connector, mm from panel center. */
  positionMm?: [number, number, number];
  /** Center-to-center spacing when count > 1, mm. */
  pitchMm?: number;
}

export const POWER_SOURCES = ['ac', 'dc', 'poe', 'battery'] as const;
export type PowerSource = (typeof POWER_SOURCES)[number];

/** Power topology metadata (future power planning / install reports). */
export interface PowerCapabilities {
  connectors: PowerConnector[];
  /** Redundant supplies (N+1 or better). */
  redundant?: boolean;
  hotSwappable?: boolean;
  /** Number of power supplies (derived from connectors when omitted). */
  psuCount?: number;
  /** PoE budget the device can deliver downstream, watts. */
  poeBudgetW?: number;
  /** How the device itself is powered. */
  sources?: PowerSource[];
}

export const AIRFLOW_DIRECTIONS = [
  'front-to-rear',
  'rear-to-front',
  'side-to-side',
  'passive',
] as const;
export type AirflowDirection = (typeof AIRFLOW_DIRECTIONS)[number];

export const VENT_LOCATIONS = [
  'front',
  'rear',
  'left',
  'right',
  'top',
  'bottom',
] as const;
export type VentLocation = (typeof VENT_LOCATIONS)[number];

/** Thermal metadata (future cooling simulation hook). Geometry only. */
export interface CoolingCapabilities {
  fanCount?: number;
  airflow?: AirflowDirection;
  ventilation?: VentLocation[];
  hotSwappableFans?: boolean;
  /** Fan rotor diameter, mm (default 40). */
  fanDiameterMm?: number;
  /** Fan centers, mm from chassis center (renders grilles when present). */
  fanPositionsMm?: [number, number, number][];
  /** Where air enters / leaves the chassis. */
  intake?: VentLocation[];
  exhaust?: VentLocation[];
}

export const DISPLAY_STATES = ['off', 'placeholder'] as const;
export type DisplayState = (typeof DISPLAY_STATES)[number];

/** Front-panel display metadata. Rendered as powered-off glass (or a
 *  faint placeholder); live UI textures are a future hook. */
export interface DisplayCapabilities {
  lcd?: boolean;
  touchscreen?: boolean;
  /** Display center, mm from faceplate center. */
  positionMm?: [number, number, number];
  /** Visible glass area, mm. */
  widthMm?: number;
  heightMm?: number;
  /** Native panel resolution, px. */
  resolution?: [number, number];
  /** Bezel border around the glass, mm (default 2). */
  bezelMm?: number;
  /** Rendered state (default 'off'). */
  state?: DisplayState;
}

/* ---- Mechanical metadata --------------------------------------------- */

/**
 * How a device physically attaches to a rack. Only geometry follows from
 * this today — interactions (sliding, install animation) come later.
 */
export const MOUNT_STYLES = [
  'rack-ears',
  'sliding-rails',
  'fixed-rails',
  'shelf',
  'rear-brackets',
  'four-post',
  'two-post',
  'wall-mount',
  'desktop',
] as const;
export type MountStyle = (typeof MOUNT_STYLES)[number];

/** Future rail-kit classification. */
export const RAIL_KIT_TYPES = ['none', 'fixed', 'sliding', 'shelf'] as const;
export type RailKitType = (typeof RAIL_KIT_TYPES)[number];

/**
 * Mechanical contact points. All values are offsets from the chassis
 * surfaces (mm), so an omitted field means "the plane is the surface
 * itself" — the engine derives everything else from the dimensions.
 * Purely declarative: the mounting solver and hardware renderer consume
 * this; no device-specific code paths exist.
 */
export interface MechanicalSpec {
  /** Attachment style. Defaults: 'rack-ears' (eia-310), 'shelf' (none). */
  mountStyle?: MountStyle;
  /** Front mounting plane, mm behind the faceplate (0 = flush). */
  frontMountPlaneMm?: number;
  /** Rear support plane, mm ahead of the chassis rear face (0 = flush). */
  rearSupportPlaneMm?: number;
  /** Bottom support plane, mm above the chassis underside (0 = flush). */
  bottomSupportPlaneMm?: number;
  /** Mounting-ear sheet thickness. */
  earThicknessMm?: number;
  /** Fore/aft offset of the ear plane from the faceplate. */
  earOffsetMm?: number;
  /** The GLB already models its ears — skip the parametric ones. */
  integratedEars?: boolean;
  /** Center of mass, mm from the chassis center (future weight planning). */
  centerOfMassMm?: [number, number, number];
  /** Rail kit the device ships with / requires (future). */
  railType?: RailKitType;
}

/**
 * Accessory classification for rail-mounted hardware (blank panels,
 * shelves, cable managers, PDUs…). Declarative only — accessories are
 * regular devices to the engine.
 */
export const ACCESSORY_KINDS = [
  'blank-panel',
  'brush-panel',
  'cantilever-shelf',
  'fixed-shelf',
  'cable-manager',
  'pdu',
  'patch-panel',
  'support-bracket',
] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

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
  /**
   * Explicit GLB correction. When absent, the universal importer derives
   * a deterministic default transform from the measured geometry (origin
   * normalization + axis matching). When present, it wins verbatim.
   */
  modelTransform?: ModelTransform;
  /**
   * How much hardware the GLB itself models. 'full' (default): the model
   * includes connectors/LEDs/displays, so only overlays (Etherlighting)
   * render procedurally. 'chassis': the model is a bare chassis and the
   * hardware layer renders every connector from metadata. Placeholder
   * devices always render the full hardware layer.
   */
  modelDetail?: 'full' | 'chassis';
  /** Vertical trim from the U boundary, in millimeters. */
  mountingOffsetMm: number;
  /**
   * Mount correction in device-local mm, applied by the placement
   * engine on top of the standard rail-flush position: [lateral,
   * vertical, depth] (+z pushes the device toward its own faceplate).
   * Authored in the Device Authoring mode when a model's ears/holes
   * don't land exactly on the rails. The GLB itself is never modified.
   */
  mountOffsetMm?: [number, number, number];
  /**
   * Set by the Device Authoring mode: every port was placed by hand, so
   * GLB connector calibration must never override these positions.
   */
  portsAuthored?: boolean;
  ports: PortDefinition[];
  leds: LedDefinition[];
  lighting?: LightingCapabilities;
  power?: PowerCapabilities;
  cooling?: CoolingCapabilities;
  display?: DisplayCapabilities;
  /** Mechanical contact points and mounting style (see MechanicalSpec). */
  mechanical?: MechanicalSpec;
  /** Set when this device is a rail accessory (blank panel, PDU, …). */
  accessoryKind?: AccessoryKind;
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

  optionalBoolean(
    source: Record<string, unknown>,
    path: string,
  ): boolean | undefined {
    const value = source[path];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      return this.fail(path, 'must be a boolean when present');
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
): ModelTransform | undefined {
  // Absent means "derive automatically from measured geometry".
  if (input === undefined) return undefined;
  const fallback: ModelTransform = {
    scale: 1,
    rotationDeg: [0, 0, 0],
    offsetMm: [0, 0, 0],
  };
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
    const location =
      entry.location === undefined
        ? undefined
        : sub.oneOf(entry, 'location', PORT_LOCATIONS);
    const positionMm =
      entry.positionMm === undefined
        ? undefined
        : isVec3(entry.positionMm)
          ? entry.positionMm
          : sub.fail('positionMm', 'must be [x, y, z] numbers');
    const pitchMm =
      entry.pitchMm === undefined
        ? undefined
        : sub.number(entry, 'pitchMm', { min: 0.1 });
    const row =
      entry.row === undefined
        ? undefined
        : sub.number(entry, 'row', { min: 0, integer: true });
    const speedGbps =
      entry.speedGbps === undefined
        ? undefined
        : sub.number(entry, 'speedGbps', { min: 0.01 });
    const poe = sub.optionalBoolean(entry, 'poe');
    const poeBudgetW =
      entry.poeBudgetW === undefined
        ? undefined
        : sub.number(entry, 'poeBudgetW', { min: 0 });
    const etherlighting = sub.optionalBoolean(entry, 'etherlighting');
    const visible = sub.optionalBoolean(entry, 'visible');
    const rotationDeg =
      entry.rotationDeg === undefined
        ? undefined
        : isVec3(entry.rotationDeg)
          ? entry.rotationDeg
          : sub.fail('rotationDeg', 'must be [x, y, z] numbers');
    const anchorMm =
      entry.anchorMm === undefined
        ? undefined
        : isVec3(entry.anchorMm)
          ? entry.anchorMm
          : sub.fail('anchorMm', 'must be [x, y, z] numbers');
    const sizeMm =
      entry.sizeMm === undefined
        ? undefined
        : Array.isArray(entry.sizeMm) &&
            entry.sizeMm.length === 2 &&
            entry.sizeMm.every((v) => typeof v === 'number' && v > 0)
          ? (entry.sizeMm as [number, number])
          : sub.fail('sizeMm', 'must be [width, height] positive numbers');
    const insertionMm =
      entry.insertionMm === undefined
        ? undefined
        : sub.number(entry, 'insertionMm', { min: 0, max: 40 });
    const exitDirMm =
      entry.exitDirMm === undefined
        ? undefined
        : isVec3(entry.exitDirMm)
          ? entry.exitDirMm
          : sub.fail('exitDirMm', 'must be [x, y, z] numbers');
    const bendRadiusMm =
      entry.bendRadiusMm === undefined
        ? undefined
        : sub.number(entry, 'bendRadiusMm', { min: 1, max: 200 });
    sub.issues.forEach(({ path, message }) =>
      checker.fail(`ports[${i}].${path}`, message),
    );
    if (id && type && count !== undefined) {
      ports.push({
        id,
        type,
        count,
        label,
        location,
        positionMm,
        pitchMm,
        row,
        rotationDeg,
        visible,
        speedGbps,
        poe,
        poeBudgetW,
        etherlighting,
        anchorMm,
        sizeMm,
        insertionMm,
        exitDirMm,
        bendRadiusMm,
      });
    }
  });
  return ports;
}

function parseLighting(
  input: unknown,
  checker: Checker,
): LightingCapabilities | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    checker.fail('lighting', 'must be an object');
    return undefined;
  }
  const sub = new Checker();
  const etherlighting = sub.optionalBoolean(input, 'etherlighting') ?? false;
  const perPortLink = sub.optionalBoolean(input, 'perPortLink') ?? false;
  const poeIndicator = sub.optionalBoolean(input, 'poeIndicator') ?? false;
  const portHighlightColor = sub.optionalString(input, 'portHighlightColor');

  let speedColors: Record<string, string> = {};
  if (input.speedColors !== undefined) {
    if (
      isRecord(input.speedColors) &&
      Object.values(input.speedColors).every((v) => typeof v === 'string')
    ) {
      speedColors = input.speedColors as Record<string, string>;
    } else {
      sub.fail('speedColors', 'must map speed classes to color strings');
    }
  }

  let statusLed: LightingCapabilities['statusLed'];
  if (input.statusLed !== undefined) {
    if (isRecord(input.statusLed)) {
      const ledSub = new Checker();
      const color = ledSub.string(input.statusLed, 'color');
      const positionMm =
        input.statusLed.positionMm === undefined
          ? undefined
          : isVec3(input.statusLed.positionMm)
            ? input.statusLed.positionMm
            : ledSub.fail('positionMm', 'must be [x, y, z] numbers');
      ledSub.issues.forEach(({ path, message }) =>
        sub.fail(`statusLed.${path}`, message),
      );
      if (color) statusLed = { color, positionMm };
    } else {
      sub.fail('statusLed', 'must be an object');
    }
  }

  let effects: string[] = [];
  if (input.effects !== undefined) {
    if (
      Array.isArray(input.effects) &&
      input.effects.every((e): e is string => typeof e === 'string')
    ) {
      effects = input.effects;
    } else {
      sub.fail('effects', 'must be an array of strings');
    }
  }

  const defaultMode =
    input.defaultMode === undefined
      ? undefined
      : sub.oneOf(input, 'defaultMode', LIGHTING_MODES);
  const brightness =
    input.brightness === undefined
      ? undefined
      : sub.number(input, 'brightness', { min: 0, max: 1 });

  sub.issues.forEach(({ path, message }) =>
    checker.fail(`lighting.${path}`, message),
  );
  return {
    etherlighting,
    perPortLink,
    poeIndicator,
    speedColors,
    portHighlightColor,
    statusLed,
    defaultMode,
    brightness,
    effects,
  };
}

function parsePower(
  input: unknown,
  checker: Checker,
): PowerCapabilities | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    checker.fail('power', 'must be an object');
    return undefined;
  }
  const sub = new Checker();
  const connectors: PowerConnector[] = [];
  if (input.connectors !== undefined) {
    if (Array.isArray(input.connectors)) {
      input.connectors.forEach((entry, i) => {
        if (!isRecord(entry)) {
          sub.fail(`connectors[${i}]`, 'must be an object');
          return;
        }
        const conn = new Checker();
        const id = conn.string(entry, 'id');
        const type = conn.oneOf(entry, 'type', POWER_CONNECTOR_TYPES);
        const count = conn.number(entry, 'count', { min: 1, integer: true });
        const location =
          entry.location === undefined
            ? undefined
            : conn.oneOf(entry, 'location', PORT_LOCATIONS);
        const label = conn.optionalString(entry, 'label');
        const positionMm =
          entry.positionMm === undefined
            ? undefined
            : isVec3(entry.positionMm)
              ? entry.positionMm
              : conn.fail('positionMm', 'must be [x, y, z] numbers');
        const pitchMm =
          entry.pitchMm === undefined
            ? undefined
            : conn.number(entry, 'pitchMm', { min: 0.1 });
        conn.issues.forEach(({ path, message }) =>
          sub.fail(`connectors[${i}].${path}`, message),
        );
        if (id && type && count !== undefined) {
          connectors.push({ id, type, count, location, label, positionMm, pitchMm });
        }
      });
    } else {
      sub.fail('connectors', 'must be an array');
    }
  }
  const redundant = sub.optionalBoolean(input, 'redundant');
  const hotSwappable = sub.optionalBoolean(input, 'hotSwappable');
  const psuCount =
    input.psuCount === undefined
      ? undefined
      : sub.number(input, 'psuCount', { min: 0, integer: true });
  const poeBudgetW =
    input.poeBudgetW === undefined
      ? undefined
      : sub.number(input, 'poeBudgetW', { min: 0 });
  let sources: PowerSource[] | undefined;
  if (input.sources !== undefined) {
    if (
      Array.isArray(input.sources) &&
      input.sources.every(
        (s): s is PowerSource =>
          typeof s === 'string' &&
          (POWER_SOURCES as readonly string[]).includes(s),
      )
    ) {
      sources = input.sources;
    } else {
      sub.fail('sources', `entries must be one of: ${POWER_SOURCES.join(', ')}`);
    }
  }
  sub.issues.forEach(({ path, message }) =>
    checker.fail(`power.${path}`, message),
  );
  return { connectors, redundant, hotSwappable, psuCount, poeBudgetW, sources };
}

function parseCooling(
  input: unknown,
  checker: Checker,
): CoolingCapabilities | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    checker.fail('cooling', 'must be an object');
    return undefined;
  }
  const sub = new Checker();
  const fanCount =
    input.fanCount === undefined
      ? undefined
      : sub.number(input, 'fanCount', { min: 0, integer: true });
  const airflow =
    input.airflow === undefined
      ? undefined
      : sub.oneOf(input, 'airflow', AIRFLOW_DIRECTIONS);
  let ventilation: VentLocation[] | undefined;
  if (input.ventilation !== undefined) {
    if (
      Array.isArray(input.ventilation) &&
      input.ventilation.every(
        (v): v is VentLocation =>
          typeof v === 'string' &&
          (VENT_LOCATIONS as readonly string[]).includes(v),
      )
    ) {
      ventilation = input.ventilation;
    } else {
      sub.fail('ventilation', `entries must be one of: ${VENT_LOCATIONS.join(', ')}`);
    }
  }
  const hotSwappableFans = sub.optionalBoolean(input, 'hotSwappableFans');
  const fanDiameterMm =
    input.fanDiameterMm === undefined
      ? undefined
      : sub.number(input, 'fanDiameterMm', { min: 10, max: 200 });
  let fanPositionsMm: [number, number, number][] | undefined;
  if (input.fanPositionsMm !== undefined) {
    if (Array.isArray(input.fanPositionsMm) && input.fanPositionsMm.every(isVec3)) {
      fanPositionsMm = input.fanPositionsMm;
    } else {
      sub.fail('fanPositionsMm', 'must be an array of [x, y, z] positions');
    }
  }
  const ventList = (path: 'intake' | 'exhaust'): VentLocation[] | undefined => {
    const value = input[path];
    if (value === undefined) return undefined;
    if (
      Array.isArray(value) &&
      value.every(
        (v): v is VentLocation =>
          typeof v === 'string' &&
          (VENT_LOCATIONS as readonly string[]).includes(v),
      )
    ) {
      return value;
    }
    sub.fail(path, `entries must be one of: ${VENT_LOCATIONS.join(', ')}`);
    return undefined;
  };
  const intake = ventList('intake');
  const exhaust = ventList('exhaust');
  sub.issues.forEach(({ path, message }) =>
    checker.fail(`cooling.${path}`, message),
  );
  return {
    fanCount,
    airflow,
    ventilation,
    hotSwappableFans,
    fanDiameterMm,
    fanPositionsMm,
    intake,
    exhaust,
  };
}

function parseDisplay(
  input: unknown,
  checker: Checker,
): DisplayCapabilities | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    checker.fail('display', 'must be an object');
    return undefined;
  }
  const sub = new Checker();
  const lcd = sub.optionalBoolean(input, 'lcd');
  const touchscreen = sub.optionalBoolean(input, 'touchscreen');
  const positionMm =
    input.positionMm === undefined
      ? undefined
      : isVec3(input.positionMm)
        ? input.positionMm
        : sub.fail('positionMm', 'must be [x, y, z] numbers');
  const widthMm =
    input.widthMm === undefined
      ? undefined
      : sub.number(input, 'widthMm', { min: 1 });
  const heightMm =
    input.heightMm === undefined
      ? undefined
      : sub.number(input, 'heightMm', { min: 1 });
  const bezelMm =
    input.bezelMm === undefined
      ? undefined
      : sub.number(input, 'bezelMm', { min: 0, max: 20 });
  let resolution: [number, number] | undefined;
  if (input.resolution !== undefined) {
    if (
      Array.isArray(input.resolution) &&
      input.resolution.length === 2 &&
      input.resolution.every((n) => typeof n === 'number' && n > 0)
    ) {
      resolution = input.resolution as [number, number];
    } else {
      sub.fail('resolution', 'must be [width, height] pixels');
    }
  }
  const state =
    input.state === undefined
      ? undefined
      : sub.oneOf(input, 'state', DISPLAY_STATES);
  sub.issues.forEach(({ path, message }) =>
    checker.fail(`display.${path}`, message),
  );
  return {
    lcd,
    touchscreen,
    positionMm,
    widthMm,
    heightMm,
    resolution,
    bezelMm,
    state,
  };
}

function parseMechanical(
  input: unknown,
  checker: Checker,
): MechanicalSpec | undefined {
  if (input === undefined) return undefined;
  if (!isRecord(input)) {
    checker.fail('mechanical', 'must be an object');
    return undefined;
  }
  const sub = new Checker();
  const mountStyle =
    input.mountStyle === undefined
      ? undefined
      : sub.oneOf(input, 'mountStyle', MOUNT_STYLES);
  const numberOr = (path: string, opts: { min?: number; max?: number } = {}) =>
    (input as Record<string, unknown>)[path] === undefined
      ? undefined
      : sub.number(input, path, opts);
  const frontMountPlaneMm = numberOr('frontMountPlaneMm', { min: 0, max: 100 });
  const rearSupportPlaneMm = numberOr('rearSupportPlaneMm', { min: 0, max: 100 });
  const bottomSupportPlaneMm = numberOr('bottomSupportPlaneMm', { min: 0, max: 50 });
  const earThicknessMm = numberOr('earThicknessMm', { min: 0.5, max: 10 });
  const earOffsetMm = numberOr('earOffsetMm', { min: -50, max: 50 });
  const integratedEars = sub.optionalBoolean(input, 'integratedEars');
  const centerOfMassMm =
    input.centerOfMassMm === undefined
      ? undefined
      : isVec3(input.centerOfMassMm)
        ? input.centerOfMassMm
        : sub.fail('centerOfMassMm', 'must be [x, y, z] numbers');
  const railType =
    input.railType === undefined
      ? undefined
      : sub.oneOf(input, 'railType', RAIL_KIT_TYPES);
  sub.issues.forEach(({ path, message }) =>
    checker.fail(`mechanical.${path}`, message),
  );
  return {
    mountStyle,
    frontMountPlaneMm,
    rearSupportPlaneMm,
    bottomSupportPlaneMm,
    earThicknessMm,
    earOffsetMm,
    integratedEars,
    centerOfMassMm,
    railType,
  };
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
    const kind =
      entry.kind === undefined ? undefined : sub.oneOf(entry, 'kind', LED_KINDS);
    const color = sub.optionalString(entry, 'color');
    const positionMm =
      entry.positionMm === undefined
        ? undefined
        : isVec3(entry.positionMm)
          ? entry.positionMm
          : sub.fail('positionMm', 'must be [x, y, z] numbers');
    const diameterMm =
      entry.diameterMm === undefined
        ? undefined
        : sub.number(entry, 'diameterMm', { min: 0.5, max: 30 });
    const intensity =
      entry.intensity === undefined
        ? undefined
        : sub.number(entry, 'intensity', { min: 0, max: 10 });
    const state =
      entry.state === undefined
        ? undefined
        : sub.oneOf(entry, 'state', LED_STATES);
    sub.issues.forEach(({ path, message }) =>
      checker.fail(`leds[${i}].${path}`, message),
    );
    if (id && label) {
      leds.push({ id, label, kind, color, positionMm, diameterMm, intensity, state });
    }
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
  const mountOffsetMm =
    input.mountOffsetMm === undefined
      ? undefined
      : isVec3(input.mountOffsetMm)
        ? input.mountOffsetMm
        : c.fail('mountOffsetMm', 'must be [x, y, z] numbers');

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
  const modelDetail =
    input.modelDetail === undefined
      ? undefined
      : c.oneOf(input, 'modelDetail', ['full', 'chassis'] as const);
  const portsAuthored = c.optionalBoolean(input, 'portsAuthored');
  const ports = parsePorts(input.ports, c);
  const leds = parseLeds(input.leds, c);
  const lighting = parseLighting(input.lighting, c);
  const power = parsePower(input.power, c);
  const cooling = parseCooling(input.cooling, c);
  const display = parseDisplay(input.display, c);
  const mechanical = parseMechanical(input.mechanical, c);
  const accessoryKind =
    input.accessoryKind === undefined
      ? undefined
      : c.oneOf(input, 'accessoryKind', ACCESSORY_KINDS);
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
      modelDetail,
      mountingOffsetMm,
      mountOffsetMm,
      portsAuthored,
      ports,
      leds,
      lighting,
      power,
      cooling,
      display,
      mechanical,
      accessoryKind,
      presentation,
    },
  };
}
