import {
  cableTypesBetween,
  CABLE_CATALOG,
  type CableTypeId,
  type CableTypeSpec,
} from './cableCatalog';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

/**
 * Pure, deterministic connection compatibility. No AI, no UI knowledge —
 * structured results with reason codes, human-readable messages and
 * suggested cable types. The cable tool, inspector and tests all consume
 * exactly this layer.
 */

export type CompatLevel = 'valid' | 'warning' | 'invalid';

export type CompatCode =
  | 'ok'
  | 'same-port'
  | 'port-occupied'
  | 'no-common-cable'
  | 'cable-not-compatible'
  | 'speed-limited'
  | 'too-short'
  | 'excess-slack'
  | 'bend-radius'
  | 'bend-angle'
  | 'route-collision';

export interface CompatResult {
  level: CompatLevel;
  code: CompatCode;
  message: string;
  /** Cable types that would work for this pair (best first). */
  suggestedTypes: CableTypeId[];
}

const PORT_CLASS_LABEL: Record<string, string> = {
  rj45: 'RJ45',
  keystone: 'keystone',
  console: 'console',
  'poe-in': 'PoE input',
  sfp: 'SFP',
  'sfp+': 'SFP+',
  sfp28: 'SFP28',
  'qsfp+': 'QSFP+',
  qsfp28: 'QSFP28',
  c14: 'IEC C14',
  c20: 'IEC C20',
  power: 'power',
  dc: 'DC power',
  usb: 'USB',
  'usb-a': 'USB-A',
  'usb-c': 'USB-C',
  serial: 'serial',
};

const label = (port: PhysicalPort): string =>
  PORT_CLASS_LABEL[port.type] ?? port.type;

export interface PortEndRef {
  deviceInstanceId: string;
  portRef: string;
}

export interface OccupancyIndex {
  /** True when the given end already terminates a cable. */
  isOccupied: (end: PortEndRef) => boolean;
}

/** Builds the occupancy predicate from serialized cable ends. */
export function occupancyFrom(
  cables: ReadonlyArray<{ source: PortEndRef; destination: PortEndRef }>,
  ignoreCableIndex?: number,
): OccupancyIndex {
  const keys = new Set<string>();
  cables.forEach((cable, i) => {
    if (i === ignoreCableIndex) return;
    keys.add(`${cable.source.deviceInstanceId}:${cable.source.portRef}`);
    keys.add(
      `${cable.destination.deviceInstanceId}:${cable.destination.portRef}`,
    );
  });
  return {
    isOccupied: (end) =>
      keys.has(`${end.deviceInstanceId}:${end.portRef}`),
  };
}

const suggested = (a: PhysicalPort, b: PhysicalPort): CableTypeId[] =>
  cableTypesBetween(a.type, b.type).map((spec) => spec.id);

/**
 * Can these two physical ports be connected at all (by any cable)?
 * Pass the occupancy index built from existing cables.
 */
export function checkPortPair(
  sourceEnd: PortEndRef,
  sourcePort: PhysicalPort,
  destEnd: PortEndRef,
  destPort: PhysicalPort,
  occupancy: OccupancyIndex,
): CompatResult {
  if (
    sourceEnd.deviceInstanceId === destEnd.deviceInstanceId &&
    sourceEnd.portRef === destEnd.portRef
  ) {
    return {
      level: 'invalid',
      code: 'same-port',
      message: 'A cable cannot connect a port to itself.',
      suggestedTypes: [],
    };
  }

  for (const [end, port] of [
    [sourceEnd, sourcePort],
    [destEnd, destPort],
  ] as const) {
    if (occupancy.isOccupied(end)) {
      return {
        level: 'invalid',
        code: 'port-occupied',
        message: `This ${label(port)} port is already connected.`,
        suggestedTypes: [],
      };
    }
  }

  const options = cableTypesBetween(sourcePort.type, destPort.type);
  if (options.length === 0) {
    return {
      level: 'invalid',
      code: 'no-common-cable',
      message: incompatibleMessage(sourcePort, destPort),
      suggestedTypes: [],
    };
  }

  return {
    level: 'valid',
    code: 'ok',
    message: `${label(sourcePort)} ↔ ${label(destPort)}`,
    suggestedTypes: options.map((o) => o.id),
  };
}

function incompatibleMessage(a: PhysicalPort, b: PhysicalPort): string {
  const sfpish = (p: PhysicalPort) => p.type.startsWith('sfp') || p.type.startsWith('qsfp');
  const copper = (p: PhysicalPort) =>
    p.type === 'rj45' || p.type === 'keystone' || p.type === 'poe-in';
  if ((sfpish(a) && copper(b)) || (sfpish(b) && copper(a))) {
    return 'SFP ports take DAC or fiber, not copper Ethernet.';
  }
  const power = (p: PhysicalPort) =>
    ['c14', 'c20', 'power', 'dc', 'iec-lock', 'nema'].includes(p.type);
  if (power(a) !== power(b)) {
    return `A ${label(a)} port cannot connect to a ${label(b)} port.`;
  }
  return `No cable connects ${label(a)} to ${label(b)}.`;
}

/**
 * Validates a specific cable type against a resolved port pair and
 * route metrics. Returns the strongest applicable finding.
 */
export function checkCable(
  spec: CableTypeSpec,
  sourcePort: PhysicalPort,
  destPort: PhysicalPort,
  metrics?: {
    minRouteLengthMm: number;
    nominalLengthMm: number;
    bendRadiusOk: boolean;
    /** Sharpest direction change on the route, degrees. */
    maxTurnAngleDeg?: number;
  },
): CompatResult {
  const fits =
    spec.compatiblePorts.includes(sourcePort.type) &&
    spec.compatiblePorts.includes(destPort.type);
  if (!fits) {
    return {
      level: 'invalid',
      code: 'cable-not-compatible',
      message: `${spec.name} does not fit ${label(sourcePort)} ↔ ${label(destPort)}.`,
      suggestedTypes: suggested(sourcePort, destPort),
    };
  }

  if (metrics) {
    if (metrics.nominalLengthMm < metrics.minRouteLengthMm) {
      return {
        level: 'invalid',
        code: 'too-short',
        message: `Selected ${formatLength(metrics.nominalLengthMm)} cable is shorter than the ${formatLength(metrics.minRouteLengthMm)} route.`,
        suggestedTypes: [spec.id],
      };
    }
    if (!metrics.bendRadiusOk) {
      return {
        level: 'warning',
        code: 'bend-radius',
        message: `The ${spec.minBendRadiusMm} mm minimum bend radius cannot be maintained on this route.`,
        suggestedTypes: [spec.id],
      };
    }
    if (
      metrics.maxTurnAngleDeg !== undefined &&
      metrics.maxTurnAngleDeg > spec.maxBendAngleDeg
    ) {
      return {
        level: 'warning',
        code: 'bend-angle',
        message: `A ${Math.round(metrics.maxTurnAngleDeg)}° turn exceeds the ${spec.maxBendAngleDeg}° this sheath tolerates.`,
        suggestedTypes: [spec.id],
      };
    }
    if (metrics.nominalLengthMm > metrics.minRouteLengthMm * 3 + 2000) {
      return {
        level: 'warning',
        code: 'excess-slack',
        message: `${formatLength(metrics.nominalLengthMm - metrics.minRouteLengthMm)} of slack is excessive for this route.`,
        suggestedTypes: [spec.id],
      };
    }
  }

  const linkSpeed = Math.max(
    sourcePort.speedGbps ?? 0,
    destPort.speedGbps ?? 0,
  );
  if (spec.maxSpeedGbps !== undefined && linkSpeed > spec.maxSpeedGbps) {
    return {
      level: 'warning',
      code: 'speed-limited',
      message: `${spec.name} limits this ${linkSpeed}G link to ${spec.maxSpeedGbps}G.`,
      suggestedTypes: suggested(sourcePort, destPort).filter(
        (id) => (CABLE_CATALOG[id].maxSpeedGbps ?? Infinity) >= linkSpeed,
      ),
    };
  }

  return { level: 'valid', code: 'ok', message: 'Compatible.', suggestedTypes: [spec.id] };
}

export const formatLength = (mm: number): string =>
  mm >= 1000 ? `${(mm / 1000).toFixed(mm % 1000 === 0 ? 0 : 2)} m` : `${Math.round(mm)} mm`;
