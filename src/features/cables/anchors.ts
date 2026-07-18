import { calibratedPort } from '@/features/devices/hardware/connectorCalibration';
import {
  resolvePhysicalPorts,
  resolvePowerConnectors,
  rotatePortVector,
  CONNECTOR_SIZES,
  type PhysicalPort,
} from '@/features/devices/hardware/physicalPorts';
import {
  devicePlacement,
  MM_TO_M,
  type DevicePose,
  type RackGeometry,
} from '@/features/rack/rackMath';
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

const sanitizeRef = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Looks up one connector by its stable ref. Historic authoring saves
 * drifted port ids by folding the `[1]` suffix into the id on every
 * round-trip (`gbe-top[1]` → `gbe-top-1[1]` → `gbe-top-1-1[1]`); refs
 * recorded before such a save no longer match. The repair walks that
 * exact transformation forward a few generations so old cables resolve
 * against today's ids — callers can compare the returned port's ref to
 * persist the healed value.
 */
export function findPhysicalPort(
  definition: DeviceDefinition,
  portRef: string,
): PhysicalPort | undefined {
  const ports = allPhysicalPorts(definition);
  const exact = ports.find((p) => p.ref === portRef);
  if (exact) return exact;
  let candidate = portRef;
  for (let hop = 0; hop < 4; hop++) {
    candidate = `${sanitizeRef(candidate)}[1]`;
    const repaired = ports.find((p) => p.ref === candidate);
    if (repaired) return repaired;
  }
  return undefined;
}

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

/** cos/sin with float noise snapped away, so the right angles every
 *  rack pose is built from (0, ±π/2, π) stay bit-exact. */
const exactTrig = (rotationY: number): { cos: number; sin: number } => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    cos: Math.abs(cos) < 1e-12 ? 0 : cos,
    sin: Math.abs(sin) < 1e-12 ? 0 : sin,
  };
};

/** Rotates a device-local point by the device's world yaw. Facing
 *  'rear' is exactly π; devices on shelves carry arbitrary yaw. */
const yawLocal = (point: Vec3, rotationY: number): Vec3 => {
  if (rotationY === 0) return point;
  const { cos, sin } = exactTrig(rotationY);
  return [
    cos * point[0] + sin * point[2],
    point[1],
    -sin * point[0] + cos * point[2],
  ];
};

/** A device-local mm point lifted into rack-local meters. Pass `pose`
 *  for devices whose placement isn't rail-derived (shelf children). */
export function deviceLocalToRackLocal(
  pointMm: Vec3,
  definition: DeviceDefinition,
  instance: { startU: number; facing: RackOrientation },
  geometry: RackGeometry,
  pose?: DevicePose,
): Vec3 {
  const { position, rotationY } =
    pose ??
    devicePlacement(definition, instance.startU, instance.facing, geometry);
  const local = yawLocal(
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
  /** Unit exit direction in rack-local space (rotation-aware). */
  exitDir: Vec3;
}

/** Resolves a port ref on a placed device to world-attachable points.
 *  GLB-calibrated connector positions override metadata when present.
 *  Pass `pose` for shelf-standing devices (arbitrary yaw). */
export function resolveEndpoint(
  definition: DeviceDefinition,
  instance: { startU: number; facing: RackOrientation },
  geometry: RackGeometry,
  portRef: string,
  pose?: DevicePose,
): ResolvedEndpoint | null {
  const port = findPhysicalPort(definition, portRef);
  if (!port) return null;
  const outwardLocal = port.location === 'front' ? 1 : -1;

  const calibrated = calibratedPort(definition.id, portRef);
  const positionMm = calibrated?.positionMm ?? port.positionMm;
  const calibratedAnchorOffset = rotatePortVector(
    [0, 0, outwardLocal * 22],
    port.rotationDeg,
  );
  const anchorMm: Vec3 = calibrated
    ? [
        positionMm[0] + calibratedAnchorOffset[0],
        positionMm[1] + calibratedAnchorOffset[1],
        positionMm[2] + calibratedAnchorOffset[2],
      ]
    : port.anchorMm;

  const resolvedPose =
    pose ??
    devicePlacement(definition, instance.startU, instance.facing, geometry);
  const surface = deviceLocalToRackLocal(
    positionMm,
    definition,
    instance,
    geometry,
    resolvedPose,
  );
  const anchor = deviceLocalToRackLocal(
    anchorMm,
    definition,
    instance,
    geometry,
    resolvedPose,
  );

  // The exit is port-local: authored direction wins, default is straight
  // out of the face; the port's authored rotation swings it, then the
  // device's world yaw lifts it into rack space.
  let localExit: Vec3 = [0, 0, outwardLocal];
  if (port.exitDirMm) {
    const [ex, ey, ez] = port.exitDirMm;
    const length = Math.hypot(ex, ey, ez);
    if (length > 1e-6) localExit = [ex / length, ey / length, ez / length];
  }
  const rotated = rotatePortVector(localExit, port.rotationDeg);
  const { cos, sin } = exactTrig(resolvedPose.rotationY);
  // `+ 0` keeps rotated zero components from becoming -0.
  const exitDir: Vec3 = [
    cos * rotated[0] + sin * rotated[2] + 0,
    rotated[1] + 0,
    -sin * rotated[0] + cos * rotated[2] + 0,
  ];
  return {
    port,
    surface,
    anchor,
    exitDir,
  };
}
