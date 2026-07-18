import {
  calibratedPort,
  type DetectedConnector,
} from '@/features/devices/hardware/connectorCalibration';
import {
  resolvePhysicalPorts,
  rotatePortVector,
  CONNECTOR_SIZES,
} from '@/features/devices/hardware/physicalPorts';
import type {
  CoolingCapabilities,
  DeviceDefinition,
  DisplayCapabilities,
  LedDefinition,
  LedKind,
  PortDefinition,
  PortEtherLighting,
  PortLedDefinition,
  PortLocation,
  PortType,
} from '@/features/devices/deviceSchema';

/**
 * The Device Authoring data model. An AuthoredPort is one individually
 * placed physical connector; the whole set serializes back into the
 * existing DeviceDefinition schema as single-count port groups, so every
 * downstream system (cables, Etherlighting, hover, anchors, inspector)
 * consumes authored devices with zero new code paths. Pure functions —
 * no three.js, no stores — fully unit-tested.
 */

export type Vec3 = [number, number, number];

export interface AuthoredPort {
  /** Unique group id (becomes `<id>[1]` as the port's stable ref). */
  id: string;
  type: PortType;
  label?: string;
  location: PortLocation;
  row?: number;
  /** Connector center, device-local mm (chassis center origin). */
  positionMm: Vec3;
  rotationDeg: Vec3;
  /** Visible opening / interaction bounds, mm. */
  sizeMm: [number, number];
  speedGbps?: number;
  poe: boolean;
  poeBudgetW?: number;
  etherlighting: boolean;
  visible: boolean;
  /** Cable anchor offset from the connector center, mm. */
  anchorMm: Vec3;
  /** Plug insertion depth into the opening, mm (catalog default when
   *  undefined). */
  insertionMm?: number;
  /** Cable exit direction, device-local (straight out when undefined). */
  exitDirMm?: Vec3;
  /** Preferred cable bend radius leaving this port, mm. */
  bendRadiusMm?: number;
  /** Optional Etherlighting refinements (auto-lit regardless). */
  etherLighting?: PortEtherLighting;
  /** Per-port indicator LED window (bezel corner link/activity light). */
  led?: PortLedDefinition;
}

/** An authorable indicator LED (schema LedDefinition, defaults baked). */
export interface AuthoredLed {
  id: string;
  label: string;
  kind: LedKind;
  color: string;
  positionMm: Vec3;
  diameterMm: number;
  intensity: number;
  on: boolean;
}

/** Cable plug protrusion used for default anchors, mm. */
export const ANCHOR_OUT_MM = 22;

const sanitizeId = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A unique id for a new port of the given type. */
export function nextPortId(ports: readonly AuthoredPort[], type: PortType): string {
  const base = sanitizeId(type);
  let n = ports.length + 1;
  // Prefer small numbers but never collide.
  for (n = 1; ports.some((p) => p.id === `${base}-${n}`); n++);
  return `${base}-${n}`;
}

export const defaultSize = (type: PortType): [number, number] => [
  CONNECTOR_SIZES[type].widthMm,
  CONNECTOR_SIZES[type].heightMm,
];

export const defaultAnchor = (location: PortLocation): Vec3 => [
  0,
  0,
  (location === 'front' ? 1 : -1) * ANCHOR_OUT_MM,
];

/** A fresh port of the given type, centered on the chosen panel face. */
export function createPort(
  ports: readonly AuthoredPort[],
  type: PortType,
  definition: DeviceDefinition,
  location: PortLocation = 'front',
): AuthoredPort {
  const z = (definition.depthMm / 2) * (location === 'front' ? 1 : -1);
  return {
    id: nextPortId(ports, type),
    type,
    location,
    positionMm: [0, 0, z],
    rotationDeg: [0, 0, 0],
    sizeMm: defaultSize(type),
    poe: false,
    etherlighting: false,
    visible: true,
    anchorMm: defaultAnchor(location),
  };
}

/**
 * Loads a definition's existing ports into the authoring model. GLB
 * calibration (when present) is baked into the loaded positions/sizes,
 * so the editor always starts from what the user actually sees.
 *
 * Ids must be round-trip stable: a single-count group keeps its group id
 * verbatim (its ref `<id>[1]` re-serializes to the identical ref), and a
 * multi-count group expands once to `<id>-<index>` singles that are then
 * stable forever. Folding the `[1]` suffix into the id (the historic
 * behavior) drifted every ref on every save and orphaned all cables.
 */
export function portsFromDefinition(
  definition: DeviceDefinition,
): AuthoredPort[] {
  const resolved = resolvePhysicalPorts(definition);
  const groupCounts = new Map<string, number>();
  for (const port of resolved) {
    groupCounts.set(port.groupId, (groupCounts.get(port.groupId) ?? 0) + 1);
  }
  const used = new Set<string>();
  const stableId = (groupId: string, index: number): string => {
    const base =
      groupCounts.get(groupId) === 1
        ? sanitizeId(groupId)
        : sanitizeId(`${groupId}-${index}`);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  return resolved.map((port) => {
    // Data-port groups only carry PortType values (power connectors
    // resolve through a separate pipeline and are not authored here).
    const type = port.type as PortType;
    const calibrated = calibratedPort(definition.id, port.ref);
    const positionMm = calibrated?.positionMm ?? port.positionMm;
    const size: [number, number] = calibrated
      ? [calibrated.widthMm, calibrated.heightMm]
      : (port.sizeMm ?? defaultSize(type));
    return {
      id: stableId(port.groupId, port.index),
      type,
      label: port.label,
      location: port.location,
      positionMm: positionMm.map(round2) as Vec3,
      rotationDeg: [...port.rotationDeg] as Vec3,
      sizeMm: size.map(round2) as [number, number],
      speedGbps: port.speedGbps,
      poe: port.poe,
      poeBudgetW: port.poeBudgetW,
      etherlighting: port.etherlighting,
      visible: port.visible,
      // Resolved anchors are rotated into device space; authoring works
      // in the port-local frame, so un-rotate for a stable round-trip.
      anchorMm: rotatePortVector(
        [
          port.anchorMm[0] - port.positionMm[0],
          port.anchorMm[1] - port.positionMm[1],
          port.anchorMm[2] - port.positionMm[2],
        ],
        port.rotationDeg,
        true,
      ),
      insertionMm: port.insertionMm,
      exitDirMm: port.exitDirMm ? ([...port.exitDirMm] as Vec3) : undefined,
      bendRadiusMm: port.bendRadiusMm,
      etherLighting: port.etherLighting,
      led: port.led ? { ...port.led } : undefined,
    };
  });
}

/** Loads a definition's LEDs for authoring (defaults resolved). */
export function ledsFromDefinition(definition: DeviceDefinition): AuthoredLed[] {
  return definition.leds.map((led, i) => ({
    id: led.id,
    label: led.label ?? led.id,
    kind: led.kind ?? 'status',
    color: led.color ?? '#3fb970',
    positionMm: led.positionMm
      ? ([...led.positionMm] as Vec3)
      : [
          -definition.widthMm / 2 + 12 + i * 6,
          definition.heightMm / 4,
          definition.depthMm / 2,
        ],
    diameterMm: led.diameterMm ?? 2,
    intensity: led.intensity ?? 1,
    on: (led.state ?? 'on') === 'on',
  }));
}

/** Serializes authored LEDs back into schema LedDefinitions. */
export const toLedDefinitions = (leds: readonly AuthoredLed[]): LedDefinition[] =>
  leds.map((led) => ({
    id: led.id,
    label: led.label,
    kind: led.kind,
    color: led.color,
    positionMm: [...led.positionMm] as Vec3,
    diameterMm: led.diameterMm,
    intensity: led.intensity,
    state: led.on ? 'on' : 'off',
  }));

/** A fresh LED near the faceplate's left edge. */
export function createLed(
  leds: readonly AuthoredLed[],
  definition: DeviceDefinition,
): AuthoredLed {
  let n = 1;
  while (leds.some((l) => l.id === `led-${n}`)) n++;
  return {
    id: `led-${n}`,
    label: `LED ${n}`,
    kind: 'status',
    color: '#3fb970',
    positionMm: [
      -definition.widthMm / 2 + 12 + (n - 1) * 6,
      definition.heightMm / 4,
      definition.depthMm / 2,
    ],
    diameterMm: 2,
    intensity: 1,
    on: true,
  };
}

const isZero = (v: Vec3) => v[0] === 0 && v[1] === 0 && v[2] === 0;
const near = (a: number, b: number, eps = 0.001) => Math.abs(a - b) < eps;

/** Serializes one authored port to a single-count schema port group. */
export function toPortDefinition(port: AuthoredPort): PortDefinition {
  const catalog = defaultSize(port.type);
  return {
    id: port.id,
    type: port.type,
    count: 1,
    label: port.label || undefined,
    location: port.location,
    positionMm: [...port.positionMm] as Vec3,
    row: port.row,
    rotationDeg: isZero(port.rotationDeg)
      ? undefined
      : ([...port.rotationDeg] as Vec3),
    visible: port.visible ? undefined : false,
    speedGbps: port.speedGbps,
    poe: port.poe || undefined,
    poeBudgetW: port.poeBudgetW,
    etherlighting: port.etherlighting || undefined,
    anchorMm:
      near(port.anchorMm[0], 0) &&
      near(port.anchorMm[1], 0) &&
      near(
        port.anchorMm[2],
        (port.location === 'front' ? 1 : -1) * ANCHOR_OUT_MM,
      )
        ? undefined
        : ([...port.anchorMm] as Vec3),
    sizeMm:
      near(port.sizeMm[0], catalog[0]) && near(port.sizeMm[1], catalog[1])
        ? undefined
        : ([...port.sizeMm] as [number, number]),
    insertionMm: port.insertionMm,
    exitDirMm: port.exitDirMm ? ([...port.exitDirMm] as Vec3) : undefined,
    bendRadiusMm: port.bendRadiusMm,
    etherLighting:
      port.etherLighting && Object.keys(port.etherLighting).length > 0
        ? port.etherLighting
        : undefined,
    led: port.led ? { ...port.led } : undefined,
  };
}

/** Device-level authoring overrides (mount, model, hardware systems). */
export interface AuthoringOverrides {
  /** Mount correction, device-local mm (placement engine). */
  mountOffsetMm?: Vec3;
  /** Explicit GLB correction (wins over the auto import transform). */
  modelTransform?: DeviceDefinition['modelTransform'];
  /** Authored indicator LEDs. */
  leds?: readonly AuthoredLed[];
  /** Authored display capabilities. */
  display?: DisplayCapabilities;
  /** Authored cooling capabilities. */
  cooling?: CoolingCapabilities;
}

/**
 * The authored definition: the base device with its ports replaced by
 * the authored set, `portsAuthored` stamped (so calibration never
 * second-guesses these positions again), and any device-level mount /
 * model corrections applied.
 */
export function definitionWithPorts(
  base: DeviceDefinition,
  ports: readonly AuthoredPort[],
  overrides: AuthoringOverrides = {},
): DeviceDefinition {
  const anyEther = ports.some((p) => p.etherlighting);
  const mount = overrides.mountOffsetMm;
  const mountOffsetMm =
    mount && !(mount[0] === 0 && mount[1] === 0 && mount[2] === 0)
      ? ([...mount] as Vec3)
      : undefined;
  return {
    ...base,
    portsAuthored: true,
    ports: ports.map(toPortDefinition),
    mountOffsetMm: mount ? mountOffsetMm : base.mountOffsetMm,
    modelTransform: overrides.modelTransform ?? base.modelTransform,
    leds: overrides.leds ? toLedDefinitions(overrides.leds) : base.leds,
    display: overrides.display ?? base.display,
    cooling: overrides.cooling ?? base.cooling,
    lighting:
      anyEther && !base.lighting
        ? {
            etherlighting: true,
            perPortLink: false,
            poeIndicator: false,
            speedColors: {},
            effects: [],
          }
        : base.lighting,
  };
}

/** Pretty metadata JSON for /public/devices/<manufacturer>/<slug>/. */
export const metadataJson = (definition: DeviceDefinition): string =>
  JSON.stringify(definition, null, 2) + '\n';

/* ---- GLB analysis → suggested placements ----------------------------- */

const CLASS_TYPE: Record<'copper' | 'sfp', PortType> = {
  copper: 'rj45',
  sfp: 'sfp+',
};

/**
 * Turns raw connector detection into concrete suggested ports: singles
 * map 1:1, bank strips are divided into catalog-pitch slots. Suggestions
 * are only ever applied by an explicit user action.
 */
export function suggestPorts(
  detected: readonly DetectedConnector[],
): AuthoredPort[] {
  const suggestions: AuthoredPort[] = [];
  for (const connector of detected) {
    if (connector.class === 'other') continue;
    const type = CLASS_TYPE[connector.class];
    const catalog = CONNECTOR_SIZES[type];

    if (connector.kind === 'single') {
      suggestions.push(makeSuggestion(suggestions, type, connector.location, [
        connector.centerMm[0],
        connector.centerMm[1],
        connector.faceZMm,
      ], [connector.sizeMm[0], connector.sizeMm[1]]));
      continue;
    }

    // Strip: catalog-pitch slots, evenly distributed inside the bank.
    const slots = Math.max(1, Math.round(connector.sizeMm[0] / catalog.pitchMm));
    const pitch = connector.sizeMm[0] / slots;
    for (let i = 0; i < slots; i++) {
      suggestions.push(makeSuggestion(suggestions, type, connector.location, [
        connector.centerMm[0] - connector.sizeMm[0] / 2 + (i + 0.5) * pitch,
        connector.centerMm[1],
        connector.faceZMm,
      ], [pitch * 0.86, connector.sizeMm[1]]));
    }
  }
  return suggestions;
}

function makeSuggestion(
  existing: readonly AuthoredPort[],
  type: PortType,
  location: PortLocation,
  positionMm: Vec3,
  sizeMm: [number, number],
): AuthoredPort {
  return {
    id: nextPortId(existing, type),
    type,
    location,
    positionMm,
    rotationDeg: [0, 0, 0],
    sizeMm: [
      Math.round(sizeMm[0] * 100) / 100,
      Math.round(sizeMm[1] * 100) / 100,
    ],
    poe: false,
    etherlighting: false,
    visible: true,
    anchorMm: defaultAnchor(location),
  };
}

/* ---- snapping ---------------------------------------------------------- */

export interface SnapSettings {
  enabled: boolean;
  /** Align to other connectors' center lines (magnetic alignment). */
  centers: boolean;
  /** Align opening edges with neighbouring openings. */
  edges: boolean;
  /** Round positions to the millimeter grid. */
  grid: boolean;
  /** Grid pitch, mm. */
  gridMm: number;
}

export const DEFAULT_SNAP: SnapSettings = {
  enabled: true,
  centers: true,
  edges: true,
  grid: true,
  gridMm: 0.5,
};

/** Magnetic capture radius, mm. */
const SNAP_RADIUS_MM = 2;

const snapAxis = (
  value: number,
  candidates: number[],
  radius = SNAP_RADIUS_MM,
): number => {
  let best = value;
  let bestDist = radius;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
};

/**
 * Applies the enabled snap rules to a dragged port position. Order:
 * magnetic center/edge alignment against sibling connectors first
 * (strong intent), then the millimeter grid for anything left free.
 */
export function snapPosition(
  port: AuthoredPort,
  positionMm: Vec3,
  others: readonly AuthoredPort[],
  snap: SnapSettings,
): Vec3 {
  if (!snap.enabled) return positionMm;
  let [x, y, z] = positionMm;
  const siblings = others.filter(
    (o) => o.id !== port.id && o.location === port.location,
  );

  if (snap.centers && siblings.length > 0) {
    y = snapAxis(y, siblings.map((s) => s.positionMm[1]));
    // Pitch continuation: one catalog pitch beside the nearest sibling.
    const pitch = CONNECTOR_SIZES[port.type].pitchMm;
    x = snapAxis(
      x,
      siblings.flatMap((s) => [
        s.positionMm[0] - pitch,
        s.positionMm[0] + pitch,
      ]),
    );
  }
  if (snap.edges && siblings.length > 0) {
    const half = port.sizeMm[0] / 2;
    x = snapAxis(
      x,
      siblings.flatMap((s) => {
        const sHalf = s.sizeMm[0] / 2;
        return [
          s.positionMm[0] + sHalf + half, // left edge to their right edge
          s.positionMm[0] - sHalf - half, // right edge to their left edge
        ];
      }),
      SNAP_RADIUS_MM / 2,
    );
    y = snapAxis(
      y,
      siblings.flatMap((s) => {
        const dh = (s.sizeMm[1] - port.sizeMm[1]) / 2;
        return [s.positionMm[1] + dh, s.positionMm[1] - dh];
      }),
      SNAP_RADIUS_MM / 2,
    );
  }
  if (snap.grid) {
    const g = snap.gridMm;
    const r = (v: number) => Math.round(v / g) * g;
    // Only round axes that magnetic alignment left untouched.
    if (x === positionMm[0]) x = r(x);
    if (y === positionMm[1]) y = r(y);
    z = r(z);
  }
  return [round2(x), round2(y), round2(z)];
}

export const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Detects the dominant center-to-center spacing among ports of the same
 * type on one face — "fit to existing connector spacing".
 */
export function detectPitchMm(
  ports: readonly AuthoredPort[],
  type: PortType,
  location: PortLocation = 'front',
): number | null {
  const xs = ports
    .filter((p) => p.type === type && p.location === location)
    .map((p) => p.positionMm[0])
    .sort((a, b) => a - b);
  if (xs.length < 2) return null;
  const gaps = xs
    .slice(1)
    .map((x, i) => round2(x - xs[i]))
    .filter((gap) => gap > 0.5);
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** Array/duplicate directions in device-local space. */
export type ArrayDirection = '+x' | '-x' | '+y' | '-y';

export const DIRECTION_VECTORS: Record<ArrayDirection, Vec3> = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
};

/**
 * Copies of `port` arrayed along a direction. `count` is the number of
 * NEW ports created (the original stays in place).
 */
export function arrayPorts(
  all: readonly AuthoredPort[],
  port: AuthoredPort,
  count: number,
  spacingMm: number,
  direction: ArrayDirection,
): AuthoredPort[] {
  const dir = DIRECTION_VECTORS[direction];
  const copies: AuthoredPort[] = [];
  const pool = [...all];
  for (let i = 1; i <= count; i++) {
    const copy: AuthoredPort = {
      ...port,
      id: nextPortId(pool, port.type),
      label: undefined,
      positionMm: [
        round2(port.positionMm[0] + dir[0] * spacingMm * i),
        round2(port.positionMm[1] + dir[1] * spacingMm * i),
        round2(port.positionMm[2] + dir[2] * spacingMm * i),
      ],
      rotationDeg: [...port.rotationDeg] as Vec3,
      sizeMm: [...port.sizeMm] as [number, number],
      anchorMm: [...port.anchorMm] as Vec3,
    };
    copies.push(copy);
    pool.push(copy);
  }
  return copies;
}
