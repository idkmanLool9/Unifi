import { chassisAabb, type Aabb } from '@/features/rack/mechanics';
import { MM_TO_M, type PlacedDevice, type RackGeometry } from '@/features/rack/rackMath';
import type { Vec3 } from './anchors';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * Deterministic cable routing. Routes are represented by a handful of
 * semantic points (anchors, exit tangents, side/clearance waypoints) —
 * never dense sampled curves — and the same inputs always produce the
 * same route. Render curves are generated downstream from these points.
 */

export const ROUTING_MODES = [
  'auto',
  'direct',
  'natural',
  'left',
  'right',
  'top',
  'bottom',
  'cable-manager',
  'manual',
] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];

export const SLACK_MODES = ['tight', 'normal', 'service-loop', 'custom'] as const;
export type SlackMode = (typeof SLACK_MODES)[number];

export interface RouteEndpoint {
  /** Connector face (cable visibly enters the connector here). */
  surface: Vec3;
  /** Plug anchor (plug body ends, sheath begins). */
  anchor: Vec3;
  /** Outward exit direction, rack-local. */
  exitDir: Vec3;
}

export interface RouteRequest {
  source: RouteEndpoint;
  destination: RouteEndpoint;
  mode: RoutingMode;
  slack: SlackMode;
  /** Selected cable length; drives visible slack. */
  nominalLengthMm: number;
  minBendRadiusMm: number;
  geometry: RackGeometry;
  /** Manual mode: user waypoints in rack-local meters. */
  waypoints?: Vec3[];
  /** Faceplate centers of mounted cable managers (rack-local meters). */
  cableManagerPoints?: Vec3[];
  /** Y of the rail span's top, for 'top' routes (rack-local meters). */
  topYM?: number;
}

export interface ComputedRoute {
  /** Semantic polyline, rack-local meters (render curves derive from it). */
  points: Vec3[];
  /** Shortest feasible length for this route shape, mm. */
  minLengthMm: number;
  /** Length of the rendered route honoring nominal length, mm. */
  routeLengthMm: number;
  /** nominal − min (negative = cable too short), mm. */
  slackMm: number;
  /** The mode auto resolved to (or the requested mode). */
  resolvedMode: Exclude<RoutingMode, 'auto'>;
  bendRadiusOk: boolean;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const dist = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const polylineLengthMm = (points: Vec3[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total / MM_TO_M;
};

/** Plug exit stub before the sheath may bend, meters. */
const EXIT_STUB_M = 0.02;
/** Clearance outside the rack posts for side routes, meters. */
const SIDE_CLEARANCE_M = 0.05;
/** Clearance above/below the rail span for top/bottom routes, meters. */
const VERTICAL_CLEARANCE_M = 0.06;

/** Deterministic auto-mode resolution. */
export function resolveAutoMode(
  source: RouteEndpoint,
  destination: RouteEndpoint,
): Exclude<RoutingMode, 'auto' | 'manual'> {
  const sameFace =
    Math.sign(source.exitDir[2]) === Math.sign(destination.exitDir[2]);
  if (!sameFace) {
    // Opposite faces: go around the nearer rack side.
    const meanX = (source.anchor[0] + destination.anchor[0]) / 2;
    return meanX >= 0 ? 'right' : 'left';
  }
  const span = dist(source.anchor, destination.anchor);
  return span < 0.3 ? 'direct' : 'natural';
}

/** Slack the mode adds beyond the straight route, as extra length mm. */
function slackAllowanceMm(slack: SlackMode, nominal: number, min: number): number {
  switch (slack) {
    case 'tight':
      return Math.min(Math.max(nominal - min, 0), 30);
    case 'normal':
      return Math.max(nominal - min, 0) * 0.5;
    case 'service-loop':
    case 'custom':
      return Math.max(nominal - min, 0);
  }
}

/**
 * Computes the semantic route. The polyline always starts at the source
 * connector surface and ends at the destination surface, so rendered
 * cables visibly enter both connectors.
 */
export function computeRoute(request: RouteRequest): ComputedRoute {
  const { source, destination, geometry, nominalLengthMm } = request;
  const resolvedMode =
    request.mode === 'auto'
      ? resolveAutoMode(source, destination)
      : (request.mode as Exclude<RoutingMode, 'auto'>);

  const srcExit = add(source.anchor, scale(source.exitDir, EXIT_STUB_M));
  const dstExit = add(destination.anchor, scale(destination.exitDir, EXIT_STUB_M));

  const core: Vec3[] = [];
  const openingHalf = geometry.externalWidthM / 2;

  switch (resolvedMode) {
    case 'direct':
      break;
    case 'natural': {
      const mid = scale(add(srcExit, dstExit), 0.5);
      core.push([mid[0], mid[1], mid[2]]); // sag applied after min-length
      break;
    }
    case 'left':
    case 'right': {
      const x = (resolvedMode === 'left' ? -1 : 1) * (openingHalf + SIDE_CLEARANCE_M);
      core.push([x, srcExit[1], srcExit[2]]);
      core.push([x, dstExit[1], dstExit[2]]);
      break;
    }
    case 'top':
    case 'bottom': {
      const y =
        resolvedMode === 'top'
          ? (request.topYM ?? Math.max(srcExit[1], dstExit[1]) + 0.15) +
            VERTICAL_CLEARANCE_M
          : Math.max(geometry.railBaseYM - VERTICAL_CLEARANCE_M, 0.02);
      core.push([srcExit[0], y, srcExit[2]]);
      core.push([dstExit[0], y, dstExit[2]]);
      break;
    }
    case 'cable-manager': {
      const via = request.cableManagerPoints?.[0];
      if (via) {
        core.push([via[0], via[1], via[2] + Math.sign(srcExit[2]) * 0.03]);
      } else {
        // Deterministic fallback: behave like natural.
        core.push(scale(add(srcExit, dstExit), 0.5));
      }
      break;
    }
    case 'manual': {
      core.push(...(request.waypoints ?? []));
      break;
    }
  }

  const skeleton: Vec3[] = [
    source.surface,
    source.anchor,
    srcExit,
    ...core,
    dstExit,
    destination.anchor,
    destination.surface,
  ];
  const minLengthMm = polylineLengthMm(skeleton);

  // Apply slack as a vertical sag on the route's midpoints (gravity),
  // scaled so the rendered route consumes the chosen nominal length.
  const slackMm = nominalLengthMm - minLengthMm;
  const allowance = slackAllowanceMm(request.slack, nominalLengthMm, minLengthMm);
  const points = skeleton.map((p) => [...p] as Vec3);
  if (allowance > 1 && points.length >= 4) {
    // Sag depth: a hanging arc of extra length ~ 2·sqrt(sag² + …); the
    // simple deterministic approximation sag ≈ allowance/2 reads right.
    const sagM = Math.min((allowance / 2) * MM_TO_M, 0.35);
    if (request.slack === 'service-loop') {
      // Controlled loop next to the source exit.
      const loopR = Math.max(request.minBendRadiusMm * MM_TO_M, sagM / 2);
      const c = points[2];
      points.splice(
        3,
        0,
        [c[0], c[1] - loopR, c[2] + loopR * Math.sign(source.exitDir[2])],
        [c[0], c[1] - 2 * loopR, c[2]],
        [c[0], c[1] - loopR, c[2] - loopR * Math.sign(source.exitDir[2])],
        [c[0], c[1], c[2]],
      );
    } else {
      const midIndex = Math.floor(points.length / 2);
      points[midIndex] = [
        points[midIndex][0],
        points[midIndex][1] - sagM,
        points[midIndex][2],
      ];
    }
  }

  const routeLengthMm = Math.max(polylineLengthMm(points), minLengthMm);

  return {
    points,
    minLengthMm: Math.round(minLengthMm),
    routeLengthMm: Math.round(routeLengthMm),
    slackMm: Math.round(slackMm),
    resolvedMode,
    bendRadiusOk: bendRadiusFeasible(points, request.minBendRadiusMm),
  };
}

/**
 * Conservative bend feasibility: at every interior knee, the shorter
 * adjacent segment must be able to host the minimum bend radius for the
 * direction change it makes.
 */
export function bendRadiusFeasible(points: Vec3[], minRadiusMm: number): boolean {
  const minR = minRadiusMm * MM_TO_M;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const v1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v2: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const cos =
      (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (l1 * l2);
    const turn = Math.acos(Math.min(1, Math.max(-1, cos)));
    if (turn < 0.2) continue; // effectively straight
    // Required tangent length for this turn at the minimum radius.
    const needed = minR * Math.tan(turn / 2);
    if (Math.min(l1, l2) < needed * 0.6) return false;
  }
  return true;
}

/**
 * Nearest standard length that leaves safe slack over the minimum
 * route (10% + 25 mm margin). Falls back to the longest standard.
 */
export function recommendLengthMm(
  minRouteLengthMm: number,
  standardLengthsMm: readonly number[],
): number {
  const needed = minRouteLengthMm * 1.1 + 25;
  const sorted = [...standardLengthsMm].sort((a, b) => a - b);
  for (const length of sorted) {
    if (length >= needed) return length;
  }
  return sorted[sorted.length - 1] ?? Math.ceil(needed);
}

/**
 * Conservative collision estimate: samples the route's segments and
 * flags passes through other devices' chassis volumes or the rack post
 * planes. Endpoint devices are excluded (a cable legitimately touches
 * its own connectors).
 */
export function estimateRouteCollisions(
  points: Vec3[],
  instances: readonly PlacedDevice[],
  getDefinition: (id: string) => DeviceDefinition | undefined,
  geometry: RackGeometry,
  excludeInstanceIds: readonly string[],
): boolean {
  const boxes: Aabb[] = [];
  for (const instance of instances) {
    if (excludeInstanceIds.includes(instance.id)) continue;
    const definition = getDefinition(instance.definitionId);
    if (!definition) continue;
    boxes.push(chassisAabb(definition, instance, geometry));
  }
  if (boxes.length === 0) return false;

  const inside = (p: Vec3, box: Aabb, marginM = 0.002): boolean =>
    p[0] > box.min[0] + marginM &&
    p[0] < box.max[0] - marginM &&
    p[1] > box.min[1] + marginM &&
    p[1] < box.max[1] - marginM &&
    p[2] > box.min[2] + marginM &&
    p[2] < box.max[2] - marginM;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(2, Math.ceil(dist(a, b) / 0.02));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const p: Vec3 = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
      if (boxes.some((box) => inside(p, box))) return true;
    }
  }
  return false;
}
