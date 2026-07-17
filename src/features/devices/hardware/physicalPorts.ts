import type {
  DeviceDefinition,
  LedDefinition,
  LedKind,
  PortLocation,
  PortType,
  PowerConnectorType,
} from '../deviceSchema';

/**
 * The physical hardware model. Every port group, power connector and
 * LED in a DeviceDefinition resolves into individually addressable
 * physical objects with stable ids and device-local millimeter
 * positions (chassis center at the origin, front face toward +Z).
 *
 * These refs are the contract for every future system — cable routing
 * terminates on `PhysicalPort.ref`, power simulation reads connectors,
 * diagnostics/AI/reports address the same ids. Pure functions, no
 * three.js, fully unit-tested.
 */

export type PhysicalConnectorType = PortType | PowerConnectorType;

export interface PhysicalPort {
  /** Stable address, unique per device: `<groupId>[<index>]` (1-based). */
  ref: string;
  groupId: string;
  index: number;
  type: PhysicalConnectorType;
  location: PortLocation;
  /** Connector center, mm from chassis center. */
  positionMm: [number, number, number];
  rotationDeg: [number, number, number];
  visible: boolean;
  label?: string;
  speedGbps?: number;
  poe: boolean;
  /** Group PoE budget, watts (shared across the group). */
  poeBudgetW?: number;
  etherlighting: boolean;
  /** Where a cable plug attaches, mm (future routing terminates here). */
  anchorMm: [number, number, number];
}

export interface ResolvedLed {
  id: string;
  label: string;
  kind: LedKind;
  color: string;
  positionMm: [number, number, number];
  diameterMm: number;
  intensity: number;
  on: boolean;
}

/** Physical footprint (width mm) and default pitch per connector type. */
export const CONNECTOR_SIZES: Record<
  PhysicalConnectorType,
  { widthMm: number; heightMm: number; pitchMm: number }
> = {
  rj45: { widthMm: 15, heightMm: 13, pitchMm: 17.9 },
  keystone: { widthMm: 16.5, heightMm: 16, pitchMm: 18.3 },
  sfp: { widthMm: 14.5, heightMm: 9.5, pitchMm: 17 },
  'sfp+': { widthMm: 14.5, heightMm: 9.5, pitchMm: 17 },
  sfp28: { widthMm: 14.5, heightMm: 9.5, pitchMm: 17 },
  'qsfp+': { widthMm: 18.5, heightMm: 9.5, pitchMm: 21 },
  qsfp28: { widthMm: 18.5, heightMm: 9.5, pitchMm: 21 },
  usb: { widthMm: 13.5, heightMm: 6.5, pitchMm: 17 },
  'usb-a': { widthMm: 13.5, heightMm: 6.5, pitchMm: 17 },
  'usb-c': { widthMm: 9.5, heightMm: 3.8, pitchMm: 13 },
  console: { widthMm: 15, heightMm: 13, pitchMm: 17.9 },
  serial: { widthMm: 31, heightMm: 13, pitchMm: 36 },
  power: { widthMm: 27, heightMm: 20, pitchMm: 40 },
  dc: { widthMm: 12, heightMm: 12, pitchMm: 20 },
  c14: { widthMm: 27, heightMm: 20, pitchMm: 40 },
  c20: { widthMm: 31, heightMm: 24, pitchMm: 45 },
  'iec-lock': { widthMm: 27, heightMm: 20, pitchMm: 40 },
  nema: { widthMm: 27, heightMm: 24, pitchMm: 40 },
  'poe-in': { widthMm: 15, heightMm: 13, pitchMm: 17.9 },
  'external-adapter': { widthMm: 12, heightMm: 12, pitchMm: 20 },
  other: { widthMm: 14, heightMm: 12, pitchMm: 18 },
};

/** Faceplate side margin for auto-laid-out ports. */
const AUTO_MARGIN_MM = 22;
/** Horizontal gap between auto-laid-out groups. */
const GROUP_GAP_MM = 9;
/** How far a cable plug sits proud of the panel face. */
const ANCHOR_OUT_MM = 22;

export const portRef = (groupId: string, index: number): string =>
  `${groupId}[${index}]`;

const rowY = (row: number | undefined, heightMm: number): number =>
  row === undefined ? 0 : (heightMm / 4) * (1 - 2 * row);

/**
 * Expands every port group into individual physical connectors.
 * Groups with an authored positionMm advance along +X by their pitch;
 * groups without one are laid out automatically — sequentially from the
 * left margin per (location, row) lane, wrapping onto the next row when
 * a lane would overrun the faceplate — so every device gets plausible,
 * in-bounds connector geometry with zero authoring.
 */
export function resolvePhysicalPorts(
  definition: DeviceDefinition,
): PhysicalPort[] {
  const ports: PhysicalPort[] = [];
  // Auto-layout cursor per (location, row) lane, in mm from center.
  const cursors = new Map<string, number>();
  const laneStart = -definition.widthMm / 2 + AUTO_MARGIN_MM;
  const laneLimit = definition.widthMm / 2 - AUTO_MARGIN_MM;

  for (const group of definition.ports) {
    const size = CONNECTOR_SIZES[group.type];
    const pitch = group.pitchMm ?? size.pitchMm;
    const location = group.location ?? 'front';
    const zFace = (definition.depthMm / 2) * (location === 'front' ? 1 : -1);
    const outward = location === 'front' ? 1 : -1;
    const anchor = group.anchorMm ?? [0, 0, outward * ANCHOR_OUT_MM];

    const push = (index: number, positionMm: [number, number, number]) =>
      ports.push({
        ref: portRef(group.id, index + 1),
        groupId: group.id,
        index: index + 1,
        type: group.type,
        location,
        positionMm,
        rotationDeg: group.rotationDeg ?? [0, 0, 0],
        visible: group.visible ?? true,
        label: group.label,
        speedGbps: group.speedGbps,
        poe: group.poe ?? false,
        poeBudgetW: group.poeBudgetW,
        etherlighting: group.etherlighting ?? false,
        anchorMm: [
          positionMm[0] + anchor[0],
          positionMm[1] + anchor[1],
          positionMm[2] + anchor[2],
        ],
      });

    if (group.positionMm) {
      // Authored origin: the author owns bounds; advance along +X.
      for (let i = 0; i < group.count; i++) {
        push(i, [
          group.positionMm[0] + i * pitch,
          group.positionMm[1],
          group.positionMm[2],
        ]);
      }
      continue;
    }

    // Auto layout with row wrapping: an undefined row is the vertical
    // center lane; wrapping (or explicit rows) use quarter-height lanes.
    let row: number | undefined = group.row;
    const laneKey = (r: number | undefined) =>
      `${location}:${r === undefined ? 'mid' : r}`;
    for (let i = 0; i < group.count; i++) {
      let cursor = cursors.get(laneKey(row)) ?? laneStart;
      if (cursor + size.widthMm > laneLimit) {
        row = row === undefined ? 1 : row + 1;
        cursor = cursors.get(laneKey(row)) ?? laneStart;
      }
      push(i, [cursor + size.widthMm / 2, rowY(row, definition.heightMm), zFace]);
      cursors.set(laneKey(row), cursor + Math.max(pitch, size.widthMm));
    }
    // Space before the next group in the final lane.
    cursors.set(
      laneKey(row),
      (cursors.get(laneKey(row)) ?? laneStart) + GROUP_GAP_MM,
    );
  }
  return ports;
}

/**
 * Resolves power connectors to the same physical model. Auto-layout
 * places them on the rear panel's right side (as built), advancing
 * leftward — where PSU inlets live on real hardware.
 */
export function resolvePowerConnectors(
  definition: DeviceDefinition,
): PhysicalPort[] {
  const connectors = definition.power?.connectors ?? [];
  const ports: PhysicalPort[] = [];
  let autoCursor = definition.widthMm / 2 - AUTO_MARGIN_MM;

  for (const group of connectors) {
    const size = CONNECTOR_SIZES[group.type];
    const pitch = group.pitchMm ?? size.pitchMm;
    const location = group.location ?? 'rear';
    const zFace = (definition.depthMm / 2) * (location === 'front' ? 1 : -1);
    const outward = location === 'front' ? 1 : -1;

    let origin: [number, number, number];
    if (group.positionMm) {
      origin = group.positionMm;
    } else {
      origin = [autoCursor - size.widthMm / 2, 0, zFace];
      autoCursor -= size.widthMm + (group.count - 1) * pitch + GROUP_GAP_MM;
    }

    for (let i = 0; i < group.count; i++) {
      const positionMm: [number, number, number] = [
        origin[0] - i * pitch * (group.positionMm ? -1 : 1),
        origin[1],
        origin[2],
      ];
      ports.push({
        ref: portRef(group.id, i + 1),
        groupId: group.id,
        index: i + 1,
        type: group.type,
        location,
        positionMm,
        rotationDeg: [0, 0, 0],
        visible: true,
        label: group.label,
        poe: false,
        etherlighting: false,
        anchorMm: [
          positionMm[0],
          positionMm[1],
          positionMm[2] + outward * ANCHOR_OUT_MM,
        ],
      });
    }
  }
  return ports;
}

const LED_KIND_COLORS: Record<LedKind, string> = {
  power: '#3fb970',
  status: '#4c82f7',
  link: '#3fb970',
  activity: '#e8a33d',
  poe: '#4c82f7',
  fan: '#3fb970',
  temperature: '#e8a33d',
  warning: '#e8a33d',
  fault: '#e5544b',
  ha: '#7c5cff',
  cloud: '#22c1a4',
  other: '#93a0b4',
};

/**
 * Resolves LEDs with every default applied. Un-positioned LEDs stack
 * along the faceplate's right edge, where indicators live on most gear.
 */
export function resolveLeds(definition: DeviceDefinition): ResolvedLed[] {
  return definition.leds.map((led: LedDefinition, i) => {
    const kind = led.kind ?? 'status';
    return {
      id: led.id,
      label: led.label,
      kind,
      color: led.color ?? LED_KIND_COLORS[kind],
      positionMm:
        led.positionMm ??
        ([
          definition.widthMm / 2 - AUTO_MARGIN_MM - i * 8,
          definition.heightMm / 4,
          definition.depthMm / 2,
        ] as [number, number, number]),
      diameterMm: led.diameterMm ?? 2,
      intensity: led.intensity ?? 1,
      on: (led.state ?? 'on') === 'on',
    };
  });
}

/** Summary used by the Inspector: connector counts grouped by type. */
export function portSummary(
  definition: DeviceDefinition,
): Array<{ type: PhysicalConnectorType; count: number }> {
  const counts = new Map<PhysicalConnectorType, number>();
  for (const group of definition.ports) {
    counts.set(group.type, (counts.get(group.type) ?? 0) + group.count);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

/** Total PoE budget: explicit power.poeBudgetW, else the group sum. */
export function poeBudgetW(definition: DeviceDefinition): number | null {
  if (definition.power?.poeBudgetW !== undefined) {
    return definition.power.poeBudgetW;
  }
  const fromGroups = definition.ports.reduce(
    (sum, group) => sum + (group.poeBudgetW ?? 0),
    0,
  );
  return fromGroups > 0 ? fromGroups : null;
}

/**
 * The Etherlighting color of a port, or null when the port isn't lit
 * (device without Etherlighting, unflagged port, or lighting turned
 * off). Single source of truth shared by the strip renderer and the
 * cable tool, so selection can enhance the existing lighting instead
 * of painting a second, competing effect over it.
 */
export function etherlightingColor(
  definition: DeviceDefinition,
  port: PhysicalPort,
): string | null {
  const lighting = definition.lighting;
  if (!lighting?.etherlighting || !port.etherlighting) return null;
  if ((lighting.defaultMode ?? 'static') === 'off') return null;
  const key = port.speedGbps === undefined ? '1g' : `${port.speedGbps}g`;
  return (
    lighting.speedColors[key] ?? lighting.portHighlightColor ?? '#4c82f7'
  );
}
