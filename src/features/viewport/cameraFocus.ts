import { MM_TO_M, type RackGeometry } from '@/features/rack/rackMath';
import { devicePlacement } from '@/features/rack/rackMath';
import type { ResolvedEndpoint, Vec3 } from '@/features/cables/anchors';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { RackOrientation } from '@/types';

/**
 * Precision camera math: focus poses for racks, devices, ports and
 * cables, plus the dynamic near-plane rule. Pure and deterministic —
 * the rig glides to whatever these functions return.
 *
 * All poses are world-space. Rack-local points are lifted through the
 * rack's yaw (orientation 'rear' spins the rack group by π).
 */

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** Closest the camera may dolly to its target, meters. */
export const MIN_CAMERA_DISTANCE = 0.06;
/** Farthest the camera may dolly, meters. */
export const MAX_CAMERA_DISTANCE = 60;

/**
 * Distance-aware near plane: generous depth precision at rack range, a
 * millimeter-scale near plane for connector close-ups. The projection
 * only updates when the value moves by more than ~20%, so normal orbit
 * never touches it.
 */
export function nearPlaneFor(distanceM: number): number {
  return Math.min(0.1, Math.max(0.004, distanceM * 0.04));
}

/** True when the change justifies a projection-matrix update. */
export const nearPlaneNeedsUpdate = (current: number, next: number): boolean =>
  Math.abs(next - current) / current > 0.2;

/** Camera distance that frames a span of `spanM` meters with margin. */
export function standoffForSpan(spanM: number, fovDeg: number, margin = 1.4): number {
  const half = (spanM / 2) * margin;
  return Math.max(
    MIN_CAMERA_DISTANCE * 2,
    half / Math.tan(((fovDeg / 2) * Math.PI) / 180),
  );
}

/** Applies the rack group's yaw to a rack-local point. */
export function rackLocalToWorld(
  point: Vec3,
  orientation: RackOrientation,
): Vec3 {
  if (orientation === 'front') return point;
  return [-point[0], point[1], -point[2]];
}

/** Frames a mounted device from its faceplate side. */
export function deviceFocusPose(
  definition: DeviceDefinition,
  instance: { startU: number; facing: RackOrientation },
  geometry: RackGeometry,
  orientation: RackOrientation,
  fovDeg: number,
): CameraPose {
  const { position, rotationY } = devicePlacement(
    definition,
    instance.startU,
    instance.facing,
    geometry,
  );
  const outward = rotationY === 0 ? 1 : -1;
  const span = Math.max(definition.widthMm, definition.heightMm * 4) * MM_TO_M;
  const standoff = standoffForSpan(span, fovDeg, 1.15);
  const halfDepth = (definition.depthMm * MM_TO_M) / 2;

  const target: Vec3 = [position[0], position[1], position[2] + outward * halfDepth];
  const camera: Vec3 = [
    target[0],
    target[1] + standoff * 0.12,
    target[2] + outward * standoff,
  ];
  return {
    position: rackLocalToWorld(camera, orientation),
    target: rackLocalToWorld(target, orientation),
  };
}

/** Standoff used when inspecting a single connector, meters. */
export const PORT_FOCUS_STANDOFF = 0.16;

/**
 * Close-up on one physical port: straight approach from the port's own
 * face (front ports from the front, rear ports from the rear), slightly
 * raised so the connector opening and its neighbours stay readable. The
 * camera never enters the device: the approach starts at the anchor,
 * which is already outside the faceplate.
 */
export function portFocusPose(
  endpoint: Pick<ResolvedEndpoint, 'surface' | 'exitDir'>,
  orientation: RackOrientation,
  standoff: number = PORT_FOCUS_STANDOFF,
): CameraPose {
  const target = endpoint.surface;
  const out = endpoint.exitDir;
  const camera: Vec3 = [
    target[0] + out[0] * standoff,
    target[1] + standoff * 0.22 + out[1] * standoff,
    target[2] + out[2] * standoff,
  ];
  return {
    position: rackLocalToWorld(camera, orientation),
    target: rackLocalToWorld(target, orientation),
  };
}

/**
 * Frames a cable by the bounding sphere of its route points, viewed
 * from the side of the route's mean exit direction.
 */
export function cableFocusPose(
  pointsRackLocal: readonly Vec3[],
  orientation: RackOrientation,
  fovDeg: number,
): CameraPose {
  const center: Vec3 = [0, 0, 0];
  for (const p of pointsRackLocal) {
    center[0] += p[0] / pointsRackLocal.length;
    center[1] += p[1] / pointsRackLocal.length;
    center[2] += p[2] / pointsRackLocal.length;
  }
  let radius = 0.05;
  for (const p of pointsRackLocal) {
    radius = Math.max(
      radius,
      Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]),
    );
  }
  const standoff = standoffForSpan(radius * 2, fovDeg, 1.3);
  const meanZ =
    pointsRackLocal.reduce((sum, p) => sum + p[2], 0) / pointsRackLocal.length;
  const side = meanZ >= 0 ? 1 : -1;
  const camera: Vec3 = [
    center[0] + standoff * 0.25,
    center[1] + standoff * 0.2,
    center[2] + side * standoff,
  ];
  return {
    position: rackLocalToWorld(camera, orientation),
    target: rackLocalToWorld(center, orientation),
  };
}

/** Straight-on detail pose for a whole rack face. */
export function faceDetailPose(
  geometry: RackGeometry,
  railTopYM: number,
  face: 'front' | 'rear',
  orientation: RackOrientation,
  fovDeg: number,
): CameraPose {
  const z = face === 'front' ? geometry.frontRailZ : geometry.rearRailZ;
  const out = face === 'front' ? 1 : -1;
  const midY = (geometry.railBaseYM + railTopYM) / 2;
  const standoff = standoffForSpan(geometry.externalWidthM * 1.1, fovDeg, 1.2);
  return {
    position: rackLocalToWorld([0, midY, z + out * standoff], orientation),
    target: rackLocalToWorld([0, midY, z], orientation),
  };
}
