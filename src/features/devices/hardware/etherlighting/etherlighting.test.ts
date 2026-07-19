import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ETHERLIGHTING,
  speedClass,
  type EtherlightingSettings,
} from './etherlightingStore';
import {
  isEligiblePort,
  portActivityState,
  portGlowColor,
  resolvePortLight,
  zonesToMask,
  ZONE_FULL,
} from './resolve';
import { effectiveRuntime } from './portRuntimeStore';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import { resolvePhysicalPorts } from '@/features/devices/hardware/physicalPorts';
import type { PhysicalPort } from '@/features/devices/hardware/physicalPorts';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;
const dmp = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-udm-pro')!;

const port = (over: Partial<PhysicalPort> = {}): PhysicalPort => ({
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
  speedGbps: 2.5,
  ...over,
});

const settings = (over: Partial<EtherlightingSettings> = {}) => ({
  ...DEFAULT_ETHERLIGHTING,
  ...over,
});

const resolve = (
  over: {
    settings?: Partial<EtherlightingSettings>;
    port?: Partial<PhysicalPort>;
    runtime?: {
      link?: boolean;
      activity?: number;
      speedGbps?: number;
      status?: 'up' | 'down' | 'warning' | 'disabled';
    };
    definition?: typeof proMax;
    xNorm?: number;
  } = {},
) =>
  resolvePortLight({
    settings: settings(over.settings),
    definition: over.definition ?? proMax,
    port: port(over.port),
    runtime: over.runtime ?? {},
    xNorm: over.xNorm ?? 0.5,
  });

describe('speed classes', () => {
  it('buckets link speeds into palette keys', () => {
    expect(speedClass(0.01)).toBe('10m');
    expect(speedClass(1)).toBe('1g');
    expect(speedClass(2.5)).toBe('2.5g');
    expect(speedClass(10)).toBe('10g');
    expect(speedClass(100)).toBe('100g');
    expect(speedClass(undefined)).toBeNull();
  });
});

describe('eligibility — every authored port lights automatically', () => {
  it('data ports are eligible without any flags or setup', () => {
    expect(isEligiblePort(port())).toBe(true);
    expect(isEligiblePort(port({ type: 'sfp+' }))).toBe(true);
    expect(isEligiblePort(port({ type: 'keystone' }))).toBe(true);
  });

  it('power ports and hidden ports are not', () => {
    expect(isEligiblePort(port({ type: 'c14' }))).toBe(false);
    expect(isEligiblePort(port({ visible: false }))).toBe(false);
  });

  it('a device with no lighting block still lights (auto philosophy)', () => {
    const bare = { ...dmp, lighting: undefined };
    const resolved = resolve({ definition: bare });
    expect(resolved.enabled).toBe(true);
  });

  it('every visible data port of the flagship switch resolves lit', () => {
    const ports = resolvePhysicalPorts(proMax).filter(
      (p) => p.visible && isEligiblePort(p),
    );
    expect(ports.length).toBeGreaterThan(20);
    for (const p of ports) {
      const resolved = resolvePortLight({
        settings: settings(),
        definition: proMax,
        port: p,
        runtime: {},
        xNorm: 0,
      });
      expect(resolved.enabled).toBe(true);
    }
  });
});

describe('settings hierarchy', () => {
  it('global disable kills everything', () => {
    expect(resolve({ settings: { enabled: false } }).enabled).toBe(false);
  });

  it('device opt-out beats the global default', () => {
    const disabled = {
      ...proMax,
      lighting: { ...proMax.lighting!, etherlighting: false },
    };
    expect(resolve({ definition: disabled }).enabled).toBe(false);
  });

  it('port override beats device and global', () => {
    expect(
      resolve({ port: { etherLighting: { enabled: false } } }).enabled,
    ).toBe(false);
    const bright = resolve({
      port: { etherLighting: { brightness: 1.4 } },
    });
    expect(bright.brightness).toBeCloseTo(1.4, 5);
  });

  it('max brightness caps every override', () => {
    const capped = resolve({
      settings: { maxBrightness: 1 },
      port: { etherLighting: { brightness: 1.8 } },
    });
    expect(capped.brightness).toBe(1);
  });
});

describe('color modes', () => {
  it('speed mode reads the global palette', () => {
    const resolved = resolve({ settings: { colorMode: 'speed' } });
    expect(resolved.color).toBe(DEFAULT_ETHERLIGHTING.speedPalette['2.5g']);
  });

  it('poe mode marks powered ports', () => {
    const poe = resolve({
      settings: { colorMode: 'poe' },
      port: { poe: true },
    });
    expect(poe.color).toBe(DEFAULT_ETHERLIGHTING.poeColor);
    const data = resolve({ settings: { colorMode: 'poe' } });
    expect(data.color).toBe(DEFAULT_ETHERLIGHTING.speedPalette['2.5g']);
  });

  it('link mode dims disconnected ports', () => {
    const down = resolve({ settings: { colorMode: 'link' } });
    const up = resolve({
      settings: { colorMode: 'link' },
      runtime: { link: true },
    });
    expect(up.brightness).toBeGreaterThan(down.brightness);
  });

  it('custom + manufacturer + gradient resolve deterministic colors', () => {
    expect(
      resolve({ settings: { colorMode: 'custom', customColor: '#ff0000' } })
        .color,
    ).toBe('#ff0000');
    const manufacturer = resolve({ settings: { colorMode: 'manufacturer' } });
    expect(manufacturer.color).toBeTruthy();
    const left = resolve({ settings: { colorMode: 'gradient' }, xNorm: 0 });
    const right = resolve({ settings: { colorMode: 'gradient' }, xNorm: 1 });
    expect(left.color).not.toBe(right.color);
  });

  it('runtime speed overrides the authored speed', () => {
    const negotiated = resolve({
      settings: { colorMode: 'speed' },
      runtime: { speedGbps: 10 },
    });
    expect(negotiated.color).toBe(DEFAULT_ETHERLIGHTING.speedPalette['10g']);
  });
});

describe('activity mode reflects live link state', () => {
  it('an unconnected port stays dark in activity mode', () => {
    const off = resolve({ settings: { colorMode: 'activity' }, runtime: {} });
    expect(off.enabled).toBe(false);
    // ...but still lights in speed mode (capability view).
    const lit = resolve({ settings: { colorMode: 'speed' }, runtime: {} });
    expect(lit.enabled).toBe(true);
  });

  it('a connected (link) port lights with the traffic flash color', () => {
    const up = resolve({
      settings: { colorMode: 'activity' },
      runtime: { link: true },
    });
    expect(up.enabled).toBe(true);
    expect(up.color).toBe(DEFAULT_ETHERLIGHTING.speedPalette['2.5g']);
    expect(up.color2).toBe(DEFAULT_ETHERLIGHTING.activityColor);
  });

  it('a down-but-connected port glows solid red', () => {
    const down = resolve({
      settings: { colorMode: 'activity' },
      runtime: { link: true, status: 'down' },
    });
    expect(down.enabled).toBe(true);
    expect(down.color).toBe(DEFAULT_ETHERLIGHTING.linkDownColor);
    expect(down.mode).toBe('static');
    expect(down.activity).toBe(0);
  });

  it('a warning port pulses amber, a disabled port is dark', () => {
    const warn = resolve({
      settings: { colorMode: 'activity' },
      runtime: { link: true, status: 'warning' },
    });
    expect(warn.color).toBe(DEFAULT_ETHERLIGHTING.warningColor);
    expect(warn.mode).toBe('breathing');
    const disabled = resolve({
      settings: { colorMode: 'activity' },
      runtime: { link: true, status: 'disabled' },
    });
    expect(disabled.enabled).toBe(false);
  });

  it('portActivityState derives up from a link and none otherwise', () => {
    expect(portActivityState({})).toBe('none');
    expect(portActivityState({ link: true })).toBe('up');
    expect(portActivityState({ link: true, status: 'down' })).toBe('down');
    expect(portActivityState({ status: 'warning' })).toBe('warning');
  });
});

describe('zones', () => {
  it('maps zone lists to shader masks', () => {
    expect(zonesToMask(['full'])).toEqual({
      mask: ZONE_FULL,
      corners: false,
      frameOffset: 0,
    });
    expect(zonesToMask(['top', 'bottom']).mask).toBe(3);
    expect(zonesToMask(['left', 'right']).mask).toBe(12);
    expect(zonesToMask(['corners']).corners).toBe(true);
    expect(zonesToMask(['inner']).frameOffset).toBe(-1);
    expect(zonesToMask(['outer']).frameOffset).toBe(1);
    // Empty selection falls back to the full border.
    expect(zonesToMask([]).mask).toBe(ZONE_FULL);
  });

  it('per-port zones override the global selection', () => {
    const resolved = resolve({
      port: { etherLighting: { zones: ['top'] } },
    });
    expect(resolved.zoneMask).toBe(1);
  });
});

describe('runtime derivation', () => {
  it('explicit runtime wins; cables imply link', () => {
    const cables = [
      {
        id: 'c1',
        source: { deviceInstanceId: 'inst-1', portRef: 'p[1]' },
        destination: { deviceInstanceId: 'inst-2', portRef: 'q[1]' },
      },
    ] as never;
    expect(effectiveRuntime({}, cables, 'inst-1', 'p[1]').link).toBe(true);
    expect(effectiveRuntime({}, cables, 'inst-1', 'p[2]').link).toBe(false);
    expect(
      effectiveRuntime(
        { 'inst-1:p[1]': { link: false } },
        cables,
        'inst-1',
        'p[1]',
      ).link,
    ).toBe(false);
  });
});

describe('UI glow color helper', () => {
  it('matches the palette for eligible ports, null for power', () => {
    expect(portGlowColor(settings(), port())).toBe(
      DEFAULT_ETHERLIGHTING.speedPalette['2.5g'],
    );
    expect(portGlowColor(settings(), port({ type: 'c14' }))).toBeNull();
  });
});
