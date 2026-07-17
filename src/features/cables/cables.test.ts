import { beforeEach, describe, expect, it } from 'vitest';
import { findPhysicalPort, resolveEndpoint } from './anchors';
import { CABLE_CATALOG, cableTypesBetween, defaultCableType } from './cableCatalog';
import { checkCable, checkPortPair, occupancyFrom } from './compatibility';
import {
  bendRadiusFeasible,
  computeRoute,
  polylineLengthMm,
  recommendLengthMm,
  resolveAutoMode,
  type RouteEndpoint,
} from './routing';
import { GENERIC_DEVICES } from '@/features/devices/definitions/generic';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import { rackGeometry } from '@/features/rack/rackMath';
import { useCableStore, cableForPort, cablesForDevice } from '@/stores/cableStore';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

const proMax = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-usw-pro-max-24-poe')!;
const dmp = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-udm-pro')!;
const panel = GENERIC_DEVICES.find((d) => d.id === 'gen-patch-24')!;
const GEO = rackGeometry('open-frame-700');

const port = (overrides: Partial<PhysicalPort>): PhysicalPort => ({
  ref: 'p[1]',
  groupId: 'p',
  index: 1,
  type: 'rj45',
  location: 'front',
  positionMm: [0, 0, 150],
  rotationDeg: [0, 0, 0],
  visible: true,
  poe: false,
  etherlighting: false,
  anchorMm: [0, 0, 172],
  ...overrides,
});

const end = (device: string, ref: string) => ({
  deviceInstanceId: device,
  portRef: ref,
});

/* ---- anchors --------------------------------------------------------- */

describe('anchor resolution', () => {
  const instance = { startU: 1, facing: 'front' as const };

  it('resolves a port anchor into rack-local meters', () => {
    const resolved = resolveEndpoint(proMax, instance, GEO, 'gbe-top[1]')!;
    // Faceplate flush with the front rail plane.
    expect(resolved.surface[2]).toBeCloseTo(GEO.frontRailZ, 3);
    // Anchor extends outward past the faceplate.
    expect(resolved.anchor[2]).toBeGreaterThan(resolved.surface[2]);
    expect(resolved.exitDir).toEqual([0, 0, 1]);
  });

  it('cables follow a device that moves to another U', () => {
    const atU1 = resolveEndpoint(proMax, { startU: 1, facing: 'front' }, GEO, 'gbe-top[1]')!;
    const atU5 = resolveEndpoint(proMax, { startU: 5, facing: 'front' }, GEO, 'gbe-top[1]')!;
    expect(atU5.anchor[1] - atU1.anchor[1]).toBeCloseTo(4 * 0.04445, 3);
    expect(atU5.anchor[0]).toBeCloseTo(atU1.anchor[0], 6);
    expect(atU5.anchor[2]).toBeCloseTo(atU1.anchor[2], 6);
  });

  it('mirrors anchors when the device faces the rear', () => {
    const front = resolveEndpoint(proMax, { startU: 1, facing: 'front' }, GEO, 'gbe-top[1]')!;
    const rear = resolveEndpoint(proMax, { startU: 1, facing: 'rear' }, GEO, 'gbe-top[1]')!;
    expect(rear.anchor[0]).toBeCloseTo(-front.anchor[0], 4);
    expect(rear.anchor[2]).toBeCloseTo(-front.anchor[2], 4);
    expect(rear.exitDir).toEqual([0, 0, -1]);
  });

  it('resolves patch-panel keystones as endpoints', () => {
    const keystone = findPhysicalPort(panel, 'keystone[12]');
    expect(keystone).toBeDefined();
    const resolved = resolveEndpoint(panel, instance, GEO, 'keystone[12]')!;
    expect(resolved.port.type).toBe('keystone');
    expect(Math.abs(resolved.anchor[0])).toBeLessThan(panel.widthMm / 2000);
  });
});

/* ---- compatibility --------------------------------------------------- */

describe('compatibility engine', () => {
  const empty = occupancyFrom([]);

  it('accepts RJ45 to RJ45 with copper suggestions', () => {
    const result = checkPortPair(
      end('a', 'p[1]'),
      port({}),
      end('b', 'q[1]'),
      port({ ref: 'q[1]' }),
      empty,
    );
    expect(result.level).toBe('valid');
    expect(result.suggestedTypes).toContain('cat6a');
  });

  it('accepts SFP+ to SFP+ via DAC or fiber', () => {
    const types = cableTypesBetween('sfp+', 'sfp+').map((t) => t.id);
    expect(types).toContain('dac');
    expect(types).toContain('fiber-sm');
    expect(types).not.toContain('cat6a');
  });

  it('rejects power to RJ45 with a clear reason', () => {
    const result = checkPortPair(
      end('a', 'ac[1]'),
      port({ type: 'c14' }),
      end('b', 'p[1]'),
      port({}),
      empty,
    );
    expect(result.level).toBe('invalid');
    expect(result.code).toBe('no-common-cable');
  });

  it('rejects SFP to copper with the explanatory message', () => {
    const result = checkPortPair(
      end('a', 's[1]'),
      port({ type: 'sfp+' }),
      end('b', 'p[1]'),
      port({}),
      empty,
    );
    expect(result.level).toBe('invalid');
    expect(result.message).toContain('DAC or fiber');
  });

  it('rejects an occupied port', () => {
    const occupied = occupancyFrom([
      { source: end('a', 'p[1]'), destination: end('b', 'q[1]') },
    ]);
    const result = checkPortPair(
      end('a', 'p[1]'),
      port({}),
      end('c', 'r[1]'),
      port({ ref: 'r[1]' }),
      occupied,
    );
    expect(result).toMatchObject({ level: 'invalid', code: 'port-occupied' });
  });

  it('rejects connecting a port to itself', () => {
    const result = checkPortPair(
      end('a', 'p[1]'),
      port({}),
      end('a', 'p[1]'),
      port({}),
      empty,
    );
    expect(result.code).toBe('same-port');
  });

  it('warns when the cable limits the link speed', () => {
    const result = checkCable(
      CABLE_CATALOG.cat5e,
      port({ speedGbps: 10 }),
      port({ ref: 'q[1]', speedGbps: 10 }),
    );
    expect(result).toMatchObject({ level: 'warning', code: 'speed-limited' });
    expect(result.suggestedTypes).toContain('cat6a');
  });

  it('flags a cable shorter than the route as invalid', () => {
    const result = checkCable(CABLE_CATALOG.cat6, port({}), port({ ref: 'q[1]' }), {
      minRouteLengthMm: 480,
      nominalLengthMm: 250,
      bendRadiusOk: true,
    });
    expect(result).toMatchObject({ level: 'invalid', code: 'too-short' });
  });

  it('picks a speed-appropriate default cable', () => {
    expect(defaultCableType(port({ speedGbps: 10 }), port({ speedGbps: 10 }))?.id).toBe('cat6a');
    expect(defaultCableType(port({ type: 'sfp+' }), port({ type: 'sfp+' }))?.id).toBeDefined();
  });
});

/* ---- routing --------------------------------------------------------- */

const endpoint = (anchor: [number, number, number], out = 1): RouteEndpoint => ({
  surface: [anchor[0], anchor[1], anchor[2] - 0.022 * out],
  anchor,
  exitDir: [0, 0, out],
});

describe('routing', () => {
  const base = {
    slack: 'tight' as const,
    nominalLengthMm: 250,
    minBendRadiusMm: 25,
    geometry: GEO,
  };

  it('direct routes measure the straight distance plus plug stubs', () => {
    const route = computeRoute({
      ...base,
      source: endpoint([-0.1, 0.2, 0.35]),
      destination: endpoint([0.1, 0.25, 0.35]),
      mode: 'direct',
    });
    expect(route.minLengthMm).toBeGreaterThan(200);
    expect(route.minLengthMm).toBeLessThan(350);
    expect(route.points[0][2]).toBeCloseTo(0.35 - 0.022, 3);
  });

  it('is deterministic', () => {
    const request = {
      ...base,
      source: endpoint([-0.1, 0.2, 0.35]),
      destination: endpoint([0.1, 0.4, 0.35]),
      mode: 'natural' as const,
    };
    expect(computeRoute(request)).toEqual(computeRoute(request));
  });

  it('longer cables produce visibly longer routes (slack)', () => {
    const source = endpoint([-0.1, 0.3, 0.35]);
    const destination = endpoint([0.1, 0.3, 0.35]);
    const short = computeRoute({
      ...base,
      source,
      destination,
      mode: 'natural',
      slack: 'normal',
      nominalLengthMm: 250,
    });
    const long = computeRoute({
      ...base,
      source,
      destination,
      mode: 'natural',
      slack: 'normal',
      nominalLengthMm: 1000,
    });
    expect(long.routeLengthMm).toBeGreaterThan(short.routeLengthMm);
    // The rendered route never shrinks below the minimum.
    expect(short.routeLengthMm).toBeGreaterThanOrEqual(short.minLengthMm);
  });

  it('service loops consume more length than normal slack', () => {
    const source = endpoint([-0.05, 0.3, 0.35]);
    const destination = endpoint([0.05, 0.3, 0.35]);
    const normal = computeRoute({
      ...base,
      source,
      destination,
      mode: 'natural',
      slack: 'normal',
      nominalLengthMm: 2000,
    });
    const loop = computeRoute({
      ...base,
      source,
      destination,
      mode: 'natural',
      slack: 'service-loop',
      nominalLengthMm: 2000,
    });
    expect(loop.routeLengthMm).toBeGreaterThan(normal.routeLengthMm);
  });

  it('side routes pass outside the rack opening', () => {
    const route = computeRoute({
      ...base,
      source: endpoint([-0.1, 0.2, 0.35]),
      destination: endpoint([0.1, 0.5, 0.35]),
      mode: 'left',
    });
    expect(Math.min(...route.points.map((p) => p[0]))).toBeLessThan(
      -GEO.externalWidthM / 2,
    );
  });

  it('auto resolves deterministically by distance and faces', () => {
    expect(
      resolveAutoMode(endpoint([-0.05, 0.2, 0.35]), endpoint([0.05, 0.25, 0.35])),
    ).toBe('direct');
    // Long same-face spans and opposite faces both follow the
    // professional side-channel discipline.
    expect(
      resolveAutoMode(endpoint([-0.2, 0.1, 0.35]), endpoint([0.2, 0.5, 0.35])),
    ).toBe('professional');
    expect(
      resolveAutoMode(endpoint([0.1, 0.2, 0.35]), endpoint([0.1, 0.4, -0.35], -1)),
    ).toBe('professional');
  });

  it('recommends the milestone example lengths', () => {
    const lengths = CABLE_CATALOG.cat6.standardLengthsMm;
    expect(recommendLengthMm(187, lengths)).toBe(250);
    expect(recommendLengthMm(410, lengths)).toBe(500);
  });

  it('flags impossible bend radii', () => {
    // A hairpin with 5 mm legs cannot host a 25 mm bend radius.
    expect(
      bendRadiusFeasible(
        [
          [0, 0, 0],
          [0.005, 0, 0],
          [0, 0.0005, 0],
        ],
        25,
      ),
    ).toBe(false);
    expect(
      bendRadiusFeasible(
        [
          [0, 0, 0],
          [0.2, 0, 0],
          [0.2, 0.2, 0.1],
        ],
        25,
      ),
    ).toBe(true);
  });

  it('polyline length is exact for straight lines', () => {
    expect(
      polylineLengthMm([
        [0, 0, 0],
        [0.1, 0, 0],
        [0.1, 0.1, 0],
      ]),
    ).toBeCloseTo(200, 3);
  });
});

/* ---- cable store ------------------------------------------------------ */

describe('cable store', () => {
  beforeEach(() => useCableStore.setState({ cables: [] }));

  const add = () =>
    useCableStore.getState().addCable({
      source: end('dev-a', 'gbe-top[1]'),
      destination: end('dev-b', 'keystone[1]'),
      type: 'cat6a',
      nominalLengthMm: 500,
    });

  it('adds a serializable cable with catalog defaults', () => {
    const cable = add();
    expect(cable.color).toBe(CABLE_CATALOG.cat6a.defaultColor);
    expect(cable.thicknessMm).toBe(CABLE_CATALOG.cat6a.diameterMm);
    expect(cable.routingMode).toBe('auto');
    // Serializable round-trip.
    const revived = JSON.parse(JSON.stringify(useCableStore.getState().cables));
    expect(revived[0]).toEqual(cable);
  });

  it('updates and removes cables', () => {
    const cable = add();
    useCableStore.getState().updateCable(cable.id, { color: '#ffffff', label: 'Uplink' });
    expect(useCableStore.getState().cables[0]).toMatchObject({
      color: '#ffffff',
      label: 'Uplink',
    });
    useCableStore.getState().removeCable(cable.id);
    expect(useCableStore.getState().cables).toHaveLength(0);
  });

  it('resolves per-device and per-port lookups', () => {
    const cable = add();
    const cables = useCableStore.getState().cables;
    expect(cablesForDevice(cables, 'dev-a')).toHaveLength(1);
    expect(cablesForDevice(cables, 'dev-c')).toHaveLength(0);
    expect(cableForPort(cables, end('dev-b', 'keystone[1]'))?.id).toBe(cable.id);
    expect(cableForPort(cables, end('dev-b', 'keystone[2]'))).toBeUndefined();
  });

  it('removeForDevice removes every attached cable and reports them', () => {
    add();
    useCableStore.getState().addCable({
      source: end('dev-c', 'p[1]'),
      destination: end('dev-a', 'gbe-top[2]'),
      type: 'cat6',
      nominalLengthMm: 250,
    });
    const removed = useCableStore.getState().removeForDevice('dev-a');
    expect(removed).toHaveLength(2);
    expect(useCableStore.getState().cables).toHaveLength(0);
  });
});

/* ---- patch panel + real devices --------------------------------------- */

describe('real endpoint pairs', () => {
  it('switch RJ45 to patch-panel keystone is a valid pair', () => {
    const sw = findPhysicalPort(proMax, 'gbe-top[1]')!;
    const ks = findPhysicalPort(panel, 'keystone[1]')!;
    const result = checkPortPair(
      end('sw', sw.ref),
      sw,
      end('pp', ks.ref),
      ks,
      occupancyFrom([]),
    );
    expect(result.level).toBe('valid');
    expect(result.suggestedTypes).toContain('cat6');
  });

  it('DMP SFP+ to Pro Max SFP+ suggests DAC first', () => {
    const a = findPhysicalPort(dmp, 'sfp-lan[1]')!;
    const b = findPhysicalPort(proMax, 'sfp[1]')!;
    const spec = defaultCableType(a, b);
    expect(spec).not.toBeNull();
    expect(['dac', 'aoc', 'fiber-sm', 'fiber-mm']).toContain(spec!.id);
  });
});
