import { describe, expect, it } from 'vitest';
import {
  cableApproachPose,
  cableFocusPose,
  CABLE_TOOL_MIN_DISTANCE,
  deviceFocusPose,
  faceDetailPose,
  MIN_CAMERA_DISTANCE,
  MAX_CAMERA_DISTANCE,
  nearPlaneFor,
  nearPlaneNeedsUpdate,
  portFocusPose,
  rackLocalToWorld,
  standoffForSpan,
} from './cameraFocus';
import { rackGeometry, devicePlacement } from '@/features/rack/rackMath';
import { resolveEndpoint } from '@/features/cables/anchors';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import { CAMERA } from '@/lib/constants';

const proMax = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-usw-pro-max-24-poe')!;
const GEO = rackGeometry('open-frame-700');
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('zoom limits', () => {
  it('permits connector-scale close-ups and keeps a sane maximum', () => {
    expect(CAMERA.minDistance).toBeLessThanOrEqual(0.08);
    expect(CAMERA.minDistance).toBeGreaterThan(0.01);
    expect(CAMERA.maxDistance).toBe(MAX_CAMERA_DISTANCE);
    expect(MIN_CAMERA_DISTANCE).toBe(CAMERA.minDistance);
  });

  it('dollys closer during cable work, but never through the hardware', () => {
    expect(CABLE_TOOL_MIN_DISTANCE).toBeLessThan(CAMERA.minDistance);
    // Must stay in front of the near-plane floor at that distance.
    expect(CABLE_TOOL_MIN_DISTANCE).toBeGreaterThan(nearPlaneFor(CABLE_TOOL_MIN_DISTANCE));
  });
});

describe('cable tool approach', () => {
  const instance = { startU: 3, facing: 'front' as const };
  const { position } = devicePlacement(proMax, 3, 'front', GEO);

  it('glides toward the faceplate along the existing sight line', () => {
    const camera: [number, number, number] = [1.5, 2.0, 3.0];
    const pose = cableApproachPose(proMax, instance, GEO, 'front', CAMERA.fov, camera)!;
    expect(pose).not.toBeNull();
    // Target sits on the faceplate plane of the device.
    expect(pose.target[1]).toBeCloseTo(position[1], 4);
    expect(pose.target[2]).toBeGreaterThan(position[2]);
    // The viewing angle is preserved: new position lies on the segment
    // from the target toward the old camera position.
    const to = (p: readonly number[]) => [
      p[0] - pose.target[0],
      p[1] - pose.target[1],
      p[2] - pose.target[2],
    ];
    const a = to(camera);
    const b = to(pose.position);
    const cross = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    expect(Math.hypot(...cross)).toBeLessThan(1e-9);
    // It stops at faceplate-framing range, not on top of a connector.
    const standoff = dist(pose.position, pose.target);
    expect(standoff).toBeGreaterThan(0.3);
    expect(standoff).toBeLessThan(dist(camera, pose.target));
  });

  it('never yanks a camera that is already close enough', () => {
    const near: [number, number, number] = [0.1, position[1], position[2] + 0.4];
    expect(cableApproachPose(proMax, instance, GEO, 'front', CAMERA.fov, near)).toBeNull();
  });

  it('approaches the rear panel when the camera views from behind', () => {
    const behind: [number, number, number] = [0.5, 1.5, -3.0];
    const pose = cableApproachPose(proMax, instance, GEO, 'front', CAMERA.fov, behind)!;
    expect(pose.target[2]).toBeLessThan(position[2]);
    expect(pose.position[2]).toBeLessThan(pose.target[2]);
  });
});

describe('dynamic near plane', () => {
  it('scales with distance inside safe bounds', () => {
    expect(nearPlaneFor(10)).toBe(0.1); // rack range: conservative
    expect(nearPlaneFor(0.06)).toBeCloseTo(0.004, 4); // close-up floor
    expect(nearPlaneFor(1)).toBeCloseTo(0.04, 4);
  });

  it('only requests projection updates on meaningful change', () => {
    expect(nearPlaneNeedsUpdate(0.1, 0.1)).toBe(false);
    expect(nearPlaneNeedsUpdate(0.1, 0.115)).toBe(false); // 15% — keep
    expect(nearPlaneNeedsUpdate(0.1, 0.05)).toBe(true);
  });
});

describe('focus poses', () => {
  const instance = { startU: 3, facing: 'front' as const };

  it('frames a device from its faceplate side', () => {
    const pose = deviceFocusPose(proMax, instance, GEO, 'front', CAMERA.fov);
    const { position } = devicePlacement(proMax, 3, 'front', GEO);
    // Target sits on the faceplate plane; camera stands off in front.
    expect(pose.target[1]).toBeCloseTo(position[1], 3);
    expect(pose.position[2]).toBeGreaterThan(pose.target[2]);
    expect(dist(pose.position, pose.target)).toBeGreaterThan(0.3);
  });

  it('approaches front ports from the front', () => {
    const endpoint = resolveEndpoint(proMax, instance, GEO, 'gbe-top[1]')!;
    const pose = portFocusPose(endpoint, 'front');
    expect(pose.position[2]).toBeGreaterThan(pose.target[2]);
    // Working margin: close, but never inside the connector.
    const standoff = dist(pose.position, pose.target);
    expect(standoff).toBeGreaterThan(0.1);
    expect(standoff).toBeLessThan(0.3);
  });

  it('approaches rear connectors from the rear', () => {
    const endpoint = resolveEndpoint(proMax, instance, GEO, 'ac[1]')!;
    expect(endpoint.port.location).toBe('rear');
    const pose = portFocusPose(endpoint, 'front');
    expect(pose.position[2]).toBeLessThan(pose.target[2]);
  });

  it('honours the rack orientation yaw', () => {
    const endpoint = resolveEndpoint(proMax, instance, GEO, 'gbe-top[1]')!;
    const front = portFocusPose(endpoint, 'front');
    const spun = portFocusPose(endpoint, 'rear');
    expect(spun.position[0]).toBeCloseTo(-front.position[0], 4);
    expect(spun.position[2]).toBeCloseTo(-front.position[2], 4);
    expect(rackLocalToWorld([1, 2, 3], 'rear')).toEqual([-1, 2, -3]);
  });

  it('frames a cable around its endpoints', () => {
    const a: [number, number, number] = [-0.2, 0.2, 0.35];
    const b: [number, number, number] = [0.2, 0.4, 0.35];
    const pose = cableFocusPose([a, b], 'front', CAMERA.fov);
    // Target is the midpoint; both endpoints fit inside the view span.
    expect(pose.target[0]).toBeCloseTo(0, 4);
    expect(pose.target[1]).toBeCloseTo(0.3, 4);
    const standoff = dist(pose.position, pose.target);
    expect(standoff).toBeGreaterThan(dist(a, b) / 2);
  });

  it('face detail views stand straight off the rail planes', () => {
    const front = faceDetailPose(GEO, 0.5, 'front', 'front', CAMERA.fov);
    expect(front.target[2]).toBeCloseTo(GEO.frontRailZ, 4);
    expect(front.position[2]).toBeGreaterThan(GEO.frontRailZ);
    const rear = faceDetailPose(GEO, 0.5, 'rear', 'front', CAMERA.fov);
    expect(rear.position[2]).toBeLessThan(GEO.rearRailZ);
  });

  it('standoff never collapses below the double minimum distance', () => {
    expect(standoffForSpan(0.001, CAMERA.fov)).toBeGreaterThanOrEqual(
      MIN_CAMERA_DISTANCE * 2,
    );
  });

  it('poses are deterministic', () => {
    const endpoint = resolveEndpoint(proMax, instance, GEO, 'gbe-top[3]')!;
    expect(portFocusPose(endpoint, 'front')).toEqual(
      portFocusPose(endpoint, 'front'),
    );
  });
});
