import { calibratedPort } from '@/features/devices/hardware/connectorCalibration';
import {
  resolvePhysicalPorts,
  resolvePowerConnectors,
  CONNECTOR_SIZES,
  type PhysicalPort,
} from '@/features/devices/hardware/physicalPorts';
import { devicePlacement, MM_TO_M, type RackGeometry } from '@/features/rack/rackMath';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { RackOrientation } from '@/types';

/**
 * Canonical cable-endpoint resolution. A PhysicalPort's anchor is
 * authored in device-local millimeters (chassis center origin, faceplate
 * toward +Z) — the same canonical space the GLB is transformed INTO by
 * the import pipeline, so model transforms never appear here. This
 * module lifts anchors into rack-local meters through the single
 * existing placement authority (devicePlacement). Cables render inside
 * the rack group, so rack orientation, entrance animation and any
 * future rack repositioning are inherited from the scene graph — no
 * transform logic is duplicated anywhere.
 */

export type Vec3 = [number, number, number];

/** All physical connectors of a device (data ports + power inlets). */
const portCache = new WeakMap<DeviceDefinition, PhysicalPort[]>();
export function allPhysicalPorts(definition: DeviceDefinition): PhysicalPort[] {
  let ports = portCache.get(definition);
  if (!ports) {
    ports = [
      ...resolvePhysicalPorts(definition),
      ...resolvePowerConnectors(definition),
    ];
    portCache.set(definition, ports);
  }
  return ports;
}

/** Looks up one connector by its stable ref. */
export const findPhysicalPort = (
  definition: DeviceDefinition,
  portRef: string,
): PhysicalPort | undefined =>
  allPhysicalPorts(definition).find((p) => p.ref === portRef);

/**
 * The connector's face: device-local position plus visible opening size.
 * GLB-calibrated geometry wins; metadata + catalog sizes are the
 * fallback for models without detectable connectors.
 */
export function portFace(
  definition: DeviceDefinition,
  port: PhysicalPort,
): { positionMm: Vec3; widthMm: number; heightMm: number } {
  const calibrated = calibratedPort(definition.id, port.ref);
  if (calibrated) {
    return {
      positionMm: calibrated.positionMm,
      widthMm: calibrated.widthMm,
      heightMm: calibrated.heightMm,
    };
  }
  const size = CONNECTOR_SIZES[port.type];
  return {
    positionMm: port.positionMm,
    widthMm: port.sizeMm?.[0] ?? size.widthMm,
    heightMm: port.sizeMm?.[1] ?? size.heightMm,
  };
}

/** Rotates a device-local point by the device's facing yaw (0 or π). */
const faceLocal = (
  point: Vec3,
  rotationY: number,
): Vec3 => {
  if (rotationY === 0) return point;
  // Facing 'rear' is exactly π: (x, z) -> (-x, -z).
  return [-point[0], point[1], -point[2]];
};

/** A device-local mm point lifted into rack-local meters. */
export function deviceLocalToRackLocal(
  pointMm: Vec3,
  definition: DeviceDefinition,
  instance: { startU: number; facing: RackOrientation },
  geometry: RackGeometry,
): Vec3 {
  const { position, rotationY } = devicePlacement(
    definition,
    instance.startU,
    instance.facing,
    geometry,
  );
  const local = faceLocal(
    [pointMm[0] * MM_TO_M, pointMm[1] * MM_TO_M, pointMm[2] * MM_TO_M],
    rotationY,
  );
  return [
    position[0] + local[0],
    position[1] + local[1],
    position[2] + local[2],
  ];
}

export interface ResolvedEndpoint {
  port: PhysicalPort;
  /** Connector face, rack-local meters (where the cable enters). */
  surface: Vec3;
  /** Cable anchor, rack-local meters (where the plug body ends). */
  anchor: Vec3;
  /** Outward exit direction in rack-local space (unit-ish, ±Z). */
  exitDir: Vec3;
}

/** Resolves a port ref on a placed device to world-attachable points.
 *  GLB-calibrated connector positions override metadata when present. */
export function resolveEndpoint(
  definition: DeviceDefinition,
  instance: { startU: number; facing: RackOrientation },
  geometry: RackGeometry,
  portRef: string,
): ResolvedEndpoint | null {
  const port = findPhysicalPort(definition, portRef);
  if (!port) return null;
  const outwardLocal = port.location === 'front' ? 1 : -1;

  const calibrated = calibratedPort(definition.id, portRef);
  const positionMm = calibrated?.positionMm ?? port.positionMm;
  const anchorMm: Vec3 = calibrated
    ? [
        positionMm[0],
        positionMm[1],
        positionMm[2] + outwardLocal * 22,
      ]
    : port.anchorMm;

  const surface = deviceLocalToRackLocal(
    positionMm,
    definition,
    instance,
    geometry,
  );
  const anchor = deviceLocalToRackLocal(
    anchorMm,
    definition,
    instance,
    geometry,
  );
  const flip = instance.facing === 'front' ? 1 : -1;
  return {
    port,
    surface,
    anchor,
    exitDir: [0, 0, outwardLocal * flip],
  };
}
