import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildRoutingGraph,
  DEFAULT_RULES,
  invalidateRoutingGraph,
  managerUsage,
  occupancyFromCables,
  planManagedRoute,
  type RoutingRules,
} from './managedRouting';
import { GENERIC_DEVICES } from '@/features/devices/definitions/generic';
import { rackGeometry } from '@/features/rack/rackMath';
import type { Vec3 } from '../anchors';
import type { RouteEndpoint } from '../routing';
import type { PlacedDevice } from '@/features/rack/rackMath';

const GEO = rackGeometry('open-frame-700');
const getDefinition = (id: string) => GENERIC_DEVICES.find((d) => d.id === id);

const place = (
  definitionId: string,
  startU: number,
  facing: 'front' | 'rear' = 'front',
): PlacedDevice => ({
  id: `inst-${definitionId}-${startU}`,
  definitionId,
  startU,
  facing,
  visible: true,
});

const endpoint = (anchor: Vec3, out: 1 | -1 = 1): RouteEndpoint => ({
  surface: [anchor[0], anchor[1], anchor[2] - out * 0.022],
  anchor,
  exitDir: [0, 0, out],
});

/** Endpoints roughly at faceplate height for a given U. */
const uY = (u: number): number => GEO.railBaseYM + (u - 0.5) * 0.04445;

const RULES: RoutingRules = { ...DEFAULT_RULES };

beforeEach(() => invalidateRoutingGraph());

describe('routing graph', () => {
  it('compiles placed manager nodes into rack space', () => {
    const manager = place('gen-cable-mgmt-1u', 5);
    const graph = buildRoutingGraph([manager], getDefinition, GEO);
    expect(graph).toHaveLength(3);
    // Nodes sit at the manager's U height, proud of the front face.
    for (const node of graph) {
      expect(node.position[1]).toBeCloseTo(uY(5), 2);
      expect(node.position[2]).toBeGreaterThan(0.3);
      expect(node.kind).toBe('horizontal-manager');
    }
    // Sorted x sweep: left, center, right.
    const xs = graph.map((n) => n.position[0]).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(xs[2]);
  });

  it('mirrors node positions for rear-facing assets', () => {
    invalidateRoutingGraph();
    const front = buildRoutingGraph(
      [place('gen-cable-mgmt-1u', 5, 'front')],
      getDefinition,
      GEO,
    );
    invalidateRoutingGraph();
    const rear = buildRoutingGraph(
      [place('gen-cable-mgmt-1u', 5, 'rear')],
      getDefinition,
      GEO,
    );
    expect(rear[0].position[2]).toBeCloseTo(-front[0].position[2], 4);
  });

  it('caches until placement changes', () => {
    const instances = [place('gen-cable-mgmt-1u', 5)];
    const a = buildRoutingGraph(instances, getDefinition, GEO);
    const b = buildRoutingGraph(instances, getDefinition, GEO);
    expect(b).toBe(a);
  });
});

describe('managed path planning', () => {
  it('routes through a manager placed between the endpoints', () => {
    const graph = buildRoutingGraph(
      [place('gen-cable-mgmt-1u', 5)],
      getDefinition,
      GEO,
    );
    const plan = planManagedRoute(
      endpoint([-0.15, uY(8), 0.38]),
      endpoint([0.12, uY(2), 0.38]),
      graph,
      { family: 'copper', rules: RULES, occupancy: new Map() },
    );
    expect(plan).not.toBeNull();
    expect(plan!.nodeKeys.length).toBeGreaterThan(0);
    // The core passes through every node: a sweep pair along the axis,
    // or a single pass-through point for perpendicular travel.
    expect(plan!.core.length).toBeGreaterThanOrEqual(plan!.nodeKeys.length);
    expect(plan!.core.length).toBeLessThanOrEqual(plan!.nodeKeys.length * 2);
    expect(plan!.warnings).toEqual([]);
  });

  it('returns null with no hardware and stays direct when indifferent', () => {
    expect(
      planManagedRoute(
        endpoint([0, uY(5), 0.38]),
        endpoint([0, uY(4), 0.38]),
        [],
        { family: 'copper', rules: RULES, occupancy: new Map() },
      ),
    ).toBeNull();

    // A manager far above both endpoints is not worth the detour.
    const graph = buildRoutingGraph(
      [place('gen-cable-mgmt-1u', 12)],
      getDefinition,
      GEO,
    );
    const plan = planManagedRoute(
      endpoint([0, uY(2), 0.38]),
      endpoint([0.05, uY(1), 0.38]),
      graph,
      { family: 'copper', rules: RULES, occupancy: new Map() },
    );
    expect(plan!.nodeKeys).toEqual([]);
  });

  it('is deterministic', () => {
    const graph = buildRoutingGraph(
      [place('gen-cable-mgmt-1u', 5), place('gen-finger-duct-2u', 6)],
      getDefinition,
      GEO,
    );
    const run = () =>
      planManagedRoute(
        endpoint([-0.15, uY(8), 0.38]),
        endpoint([0.12, uY(2), 0.38]),
        graph,
        { family: 'copper', rules: RULES, occupancy: new Map() },
      )!.nodeKeys.join('|');
    expect(run()).toBe(run());
  });

  it('separates power from data hardware', () => {
    const raceway = place('gen-power-raceway-1u', 5, 'rear');
    const graph = buildRoutingGraph([raceway], getDefinition, GEO);
    // Rear-side endpoints straddling the raceway.
    const src = endpoint([-0.1, uY(8), -0.35], -1);
    const dst = endpoint([0.1, uY(2), -0.35], -1);

    const power = planManagedRoute(src, dst, graph, {
      family: 'power',
      rules: RULES,
      occupancy: new Map(),
    })!;
    const data = planManagedRoute(src, dst, graph, {
      family: 'copper',
      rules: RULES,
      occupancy: new Map(),
    })!;
    expect(power.nodeKeys.length).toBeGreaterThan(0);
    expect(data.nodeKeys).toEqual([]); // data refuses the power raceway
  });

  it('forcing an asset requires passing it and reports capacity', () => {
    const manager = place('gen-cable-ring-1u', 5);
    const graph = buildRoutingGraph([manager], getDefinition, GEO);
    const src = endpoint([0, uY(2), 0.38]);
    const dst = endpoint([0.05, uY(1), 0.38]);

    const forced = planManagedRoute(src, dst, graph, {
      family: 'copper',
      rules: RULES,
      occupancy: new Map(),
      forceInstanceId: manager.id,
    })!;
    expect(forced.nodeKeys.length).toBeGreaterThan(0);

    // Fill EVERY node of the asset to capacity (the planner steers to
    // free nodes when one remains) → forced route now warns.
    const occupancy = new Map(graph.map((n) => [n.key, 6]));
    const warned = planManagedRoute(src, dst, graph, {
      family: 'copper',
      rules: RULES,
      occupancy,
      forceInstanceId: manager.id,
    })!;
    expect(warned.warnings.some((w) => w.includes('full'))).toBe(true);
  });
});

describe('occupancy accounting', () => {
  it('aggregates routed keys and excludes the requesting cable', () => {
    const cables = [
      { id: 'a', routedNodeKeys: ['m:1', 'm:2'] },
      { id: 'b', routedNodeKeys: ['m:1'] },
      { id: 'c' },
    ];
    const all = occupancyFromCables(cables);
    expect(all.get('m:1')).toBe(2);
    expect(all.get('m:2')).toBe(1);
    const withoutA = occupancyFromCables(cables, 'a');
    expect(withoutA.get('m:1')).toBe(1);
    expect(withoutA.get('m:2')).toBeUndefined();
  });

  it('summarizes per-manager usage for the inspector', () => {
    const manager = place('gen-cable-mgmt-1u', 5);
    const graph = buildRoutingGraph([manager], getDefinition, GEO);
    const occupancy = new Map([[graph[0].key, 5]]);
    const usage = managerUsage(manager.id, graph, occupancy);
    expect(usage.capacity).toBe(24);
    expect(usage.used).toBe(5);
    expect(usage.perNode).toHaveLength(3);
    expect(usage.perNode[0].used).toBe(5);
  });
});
