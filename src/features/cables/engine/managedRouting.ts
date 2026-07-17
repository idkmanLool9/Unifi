import { devicePlacement, MM_TO_M } from '@/features/rack/rackMath';
import type { PlacedDevice, RackGeometry } from '@/features/rack/rackMath';
import type { Vec3 } from '../anchors';
import type { RouteEndpoint } from '../routing';
import type { CableCategory } from '../cableCatalog';
import type {
  CableFamilyId,
  CableManagementKind,
  DeviceDefinition,
} from '@/features/devices/deviceSchema';

/**
 * Managed routing — the node-graph layer of the Cable Engine. Placed
 * cable-management hardware exposes routing nodes (pure metadata); this
 * module compiles them into a rack-space graph and finds the cheapest
 * installer-plausible path between two ports with Dijkstra over a
 * deterministic cost model:
 *
 *   edge cost = distance × node attractiveness × family separation
 *               × capacity pressure × vertical-discipline penalty
 *
 * Unmanaged "air" runs pay a configurable penalty, so routes prefer
 * hardware whenever hardware plausibly helps — exactly like a careful
 * installer — while short direct patches stay direct. The result feeds
 * the ordinary routing pipeline (exits, slack drape, arc fillets), so
 * managed cables render exactly like every other cable.
 */

export interface RackRoutingNode {
  /** `${instanceId}:${nodeId}` — stable across sessions. */
  key: string;
  instanceId: string;
  definitionId: string;
  nodeId: string;
  kind: CableManagementKind;
  /** Node center, rack-local meters. */
  position: Vec3;
  /** Travel axis through the node, rack-local unit vector. */
  axis: Vec3;
  costFactor: number;
  capacity: number;
  assetCapacity: number;
  preferredFamilies?: CableFamilyId[];
  enclosed: boolean;
  bendRadiusMm?: number;
  /**
   * Half-length of the continuous slot this node represents along its
   * axis, meters — cables pass anywhere inside it, not only at the
   * center point.
   */
  spanM: number;
}

export interface RoutingRules {
  /** Penalty multiplier for unmanaged air runs (1 = indifferent). */
  managerPreference: number;
  /** Keep power away from data hardware (and vice versa). */
  separatePowerData: boolean;
  /** Warn when a DAC exceeds this route length. */
  dacMaxLengthMm: number;
}

export const DEFAULT_RULES: RoutingRules = {
  managerPreference: 1.7,
  separatePowerData: true,
  dacMaxLengthMm: 3000,
};

/* ---- graph construction (cached) -------------------------------------- */

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dist = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

let graphCache: { key: string; nodes: RackRoutingNode[] } | null = null;

/** Compiles every placed management asset's nodes into rack space. */
export function buildRoutingGraph(
  instances: readonly PlacedDevice[],
  getDefinition: (id: string) => DeviceDefinition | undefined,
  geometry: RackGeometry,
): RackRoutingNode[] {
  const key =
    instances
      .map((i) => `${i.id}:${i.definitionId}:${i.startU}:${i.facing}:${i.visible}`)
      .join('|') + `|${geometry.railBaseYM}:${geometry.railSpacingM}`;
  if (graphCache?.key === key) return graphCache.nodes;

  const nodes: RackRoutingNode[] = [];
  for (const instance of instances) {
    if (!instance.visible) continue;
    const definition = getDefinition(instance.definitionId);
    const spec = definition?.cableManagement;
    if (!definition || !spec) continue;
    const { position } = devicePlacement(
      definition,
      instance.startU,
      instance.facing,
      geometry,
    );
    const flip = instance.facing === 'front' ? 1 : -1;
    // Each node owns a continuous slot reaching halfway to its nearest
    // sibling (or a default reach for single-node assets).
    const spanFor = (index: number): number => {
      let nearest = Infinity;
      for (let other = 0; other < spec.nodes.length; other++) {
        if (other === index) continue;
        const d = dist(
          spec.nodes[index].positionMm as Vec3,
          spec.nodes[other].positionMm as Vec3,
        );
        nearest = Math.min(nearest, d);
      }
      return nearest === Infinity ? 0.06 : (nearest / 2) * MM_TO_M;
    };
    for (const [index, node] of spec.nodes.entries()) {
      const world = add(position, [
        flip * node.positionMm[0] * MM_TO_M,
        node.positionMm[1] * MM_TO_M,
        flip * node.positionMm[2] * MM_TO_M,
      ]);
      const rawAxis = node.axisMm ?? [1, 0, 0];
      const axisLength = Math.hypot(...rawAxis) || 1;
      nodes.push({
        key: `${instance.id}:${node.id}`,
        instanceId: instance.id,
        definitionId: definition.id,
        nodeId: node.id,
        kind: spec.kind,
        position: world,
        axis: [
          (flip * rawAxis[0]) / axisLength,
          rawAxis[1] / axisLength,
          (flip * rawAxis[2]) / axisLength,
        ],
        costFactor: spec.costFactor ?? 1,
        capacity: node.capacity ?? Math.ceil(spec.capacity / spec.nodes.length),
        assetCapacity: spec.capacity,
        preferredFamilies: spec.preferredFamilies,
        enclosed: spec.enclosed ?? false,
        bendRadiusMm: node.bendRadiusMm,
        spanM: spanFor(index),
      });
    }
  }
  graphCache = { key, nodes };
  return nodes;
}

/** Test hook: drops the memoized graph. */
export function invalidateRoutingGraph(): void {
  graphCache = null;
}

/* ---- cost model ------------------------------------------------------- */

const POWER_FAMILY: CableFamilyId = 'power';

function familyPenalty(
  node: RackRoutingNode,
  family: CableCategory,
  rules: RoutingRules,
): number {
  const preferred = node.preferredFamilies;
  if (!preferred || preferred.length === 0) {
    // Neutral hardware: power/data separation still applies to
    // dedicated power hardware elsewhere, not here.
    return 1;
  }
  if (preferred.includes(family as CableFamilyId)) return 0.85;
  if (
    rules.separatePowerData &&
    (preferred.includes(POWER_FAMILY)) !== (family === 'power')
  ) {
    return 4; // strongly repel: mains in data ducts and vice versa
  }
  return 1.6;
}

function capacityPenalty(occupancy: number, capacity: number): number {
  if (occupancy >= capacity) return 5;
  if (occupancy >= capacity * 0.8) return 1.6;
  return 1;
}

/** Attractiveness of traveling INTO a node (lower = preferred). */
function nodeFactor(
  node: RackRoutingNode,
  family: CableCategory,
  occupancy: ReadonlyMap<string, number>,
  rules: RoutingRules,
): number {
  return (
    node.costFactor *
    familyPenalty(node, family, rules) *
    capacityPenalty(occupancy.get(node.key) ?? 0, node.capacity)
  );
}

/** Vertical air travel without vertical hardware breaks the discipline. */
function verticalPenalty(
  a: Vec3,
  b: Vec3,
  viaVertical: boolean,
): number {
  const dy = Math.abs(b[1] - a[1]);
  const dxz = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (viaVertical || dy < 0.09 || dy < dxz) return 1;
  return 1.35;
}

/* ---- path search ------------------------------------------------------ */

export interface ManagedRouteOptions {
  family: CableCategory;
  rules: RoutingRules;
  /** Cables already occupying nodes, keyed by node key. */
  occupancy: ReadonlyMap<string, number>;
  /** Restrict the path to one asset's nodes and require using it. */
  forceInstanceId?: string;
  /** Extra manager preference (Cable-Manager-Priority mode). */
  managerBoost?: number;
  /**
   * Bundle members lie side by side inside a slot: this shifts the
   * pass position along each node's axis, meters (0 = loom center).
   */
  slotOffsetM?: number;
}

export interface ManagedRoute {
  /** Core waypoints (rack-local meters) for the routing pipeline. */
  core: Vec3[];
  /** Keys of every routing node the path passes through, in order. */
  nodeKeys: string[];
  /** Human-readable routing warnings (capacity, separation). */
  warnings: string[];
}

/**
 * Plans the managed path between two resolved endpoints. Deterministic:
 * identical inputs always produce the identical node sequence. Returns
 * null when no management hardware is placed (callers fall back to the
 * unmanaged professional discipline).
 */
export function planManagedRoute(
  source: RouteEndpoint,
  destination: RouteEndpoint,
  graph: readonly RackRoutingNode[],
  options: ManagedRouteOptions,
): ManagedRoute | null {
  let nodes = graph;
  if (options.forceInstanceId) {
    nodes = graph.filter((n) => n.instanceId === options.forceInstanceId);
  }
  if (nodes.length === 0) return null;

  const air = options.rules.managerPreference * (options.managerBoost ?? 1);
  const src = source.anchor;
  const dst = destination.anchor;

  // Vertices: 0 = source, 1..n = nodes, n+1 = destination.
  const V = nodes.length + 2;
  const DST = V - 1;
  const positions: Vec3[] = [src, ...nodes.map((n) => n.position), dst];

  const factor = (index: number): number =>
    index === 0 || index === DST
      ? 1
      : nodeFactor(nodes[index - 1], options.family, options.occupancy, options.rules);
  const isVertical = (index: number): boolean =>
    index > 0 && index < DST && nodes[index - 1].kind === 'vertical-manager';

  const edgeCost = (a: number, b: number): number => {
    const base = dist(positions[a], positions[b]);
    // Entering hardware discounts by its factor; pure air pays the
    // unmanaged penalty. Edges between two nodes average their pull.
    const attract =
      b === DST
        ? a === 0
          ? air // direct src → dst without any hardware
          : 1
        : factor(b);
    const viaVertical = isVertical(a) || isVertical(b);
    return base * attract * verticalPenalty(positions[a], positions[b], viaVertical);
  };

  // Dijkstra over the small dense graph (V rarely exceeds a few hundred).
  const costs = new Array<number>(V).fill(Infinity);
  const previous = new Array<number>(V).fill(-1);
  const done = new Array<boolean>(V).fill(false);
  costs[0] = 0;
  for (let iter = 0; iter < V; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < V; i++) {
      if (!done[i] && costs[i] < best) {
        best = costs[i];
        u = i;
      }
    }
    if (u === -1 || u === DST) break;
    done[u] = true;
    for (let v = 1; v < V; v++) {
      if (done[v] || v === u) continue;
      if (u === 0 && v === DST && options.forceInstanceId) continue; // must use it
      const next = costs[u] + edgeCost(u, v);
      if (next < costs[v]) {
        costs[v] = next;
        previous[v] = u;
      }
    }
  }

  // Recover the node sequence.
  const chain: number[] = [];
  for (let at = DST; at !== -1; at = previous[at]) chain.unshift(at);
  if (chain[0] !== 0 || chain[chain.length - 1] !== DST) return null;
  const chosen = chain.slice(1, -1).map((v) => nodes[v - 1]);

  // Sweep through each chosen node along its travel axis.
  const core: Vec3[] = [];
  const warnings: string[] = [];
  chosen.forEach((node, index) => {
    const before = index === 0 ? src : chosen[index - 1].position;
    const after = index === chosen.length - 1 ? dst : chosen[index + 1].position;
    // The node is a continuous slot: the cable passes wherever the
    // straight run naturally crosses it. Project the run's midpoint
    // onto the slot axis (clamped to the slot's reach) — never force a
    // lateral detour to the node's center.
    const mid: Vec3 = [
      (before[0] + after[0]) / 2,
      (before[1] + after[1]) / 2,
      (before[2] + after[2]) / 2,
    ];
    const t = Math.min(
      node.spanM,
      Math.max(
        -node.spanM,
        (mid[0] - node.position[0]) * node.axis[0] +
          (mid[1] - node.position[1]) * node.axis[1] +
          (mid[2] - node.position[2]) * node.axis[2] +
          (options.slotOffsetM ?? 0),
      ),
    );
    const pass = add(node.position, [
      node.axis[0] * t,
      node.axis[1] * t,
      node.axis[2] * t,
    ]);

    // One knot per node: the projected pass position. The spline
    // stage's arc fillet turns the knot into the smooth dressing curve
    // a real installer's hand would make — explicit sweep segments
    // only starve the fillet of runway and kink the sheath.
    core.push(pass);

    const used = options.occupancy.get(node.key) ?? 0;
    if (used >= node.capacity) {
      warnings.push(
        `${node.kind.replace('-', ' ')} node ${node.nodeId} is full (${used}/${node.capacity}) — add another manager or reroute.`,
      );
    }
    if (
      options.rules.separatePowerData &&
      node.preferredFamilies?.includes('power') &&
      options.family !== 'power'
    ) {
      warnings.push(
        `Data cable passes through the power raceway — enable a data path or move the run.`,
      );
    }
  });

  return { core, nodeKeys: chosen.map((n) => n.key), warnings };
}

/* ---- occupancy -------------------------------------------------------- */

/** Node occupancy derived from every cable's persisted routed keys. */
export function occupancyFromCables(
  cables: ReadonlyArray<{ id: string; routedNodeKeys?: string[] }>,
  excludeCableId?: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const cable of cables) {
    if (cable.id === excludeCableId) continue;
    for (const key of cable.routedNodeKeys ?? []) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return map;
}

/** Per-asset usage summary for the manager inspector. */
export interface ManagerUsage {
  instanceId: string;
  used: number;
  capacity: number;
  perNode: Array<{ nodeId: string; key: string; used: number; capacity: number }>;
}

export function managerUsage(
  instanceId: string,
  graph: readonly RackRoutingNode[],
  occupancy: ReadonlyMap<string, number>,
): ManagerUsage {
  const nodes = graph.filter((n) => n.instanceId === instanceId);
  const perNode = nodes.map((n) => ({
    nodeId: n.nodeId,
    key: n.key,
    used: occupancy.get(n.key) ?? 0,
    capacity: n.capacity,
  }));
  return {
    instanceId,
    used: perNode.reduce((sum, n) => sum + n.used, 0),
    capacity: nodes[0]?.assetCapacity ?? 0,
    perNode,
  };
}
