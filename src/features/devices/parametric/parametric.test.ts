import { describe, expect, it } from 'vitest';
import { buildChassisSpec, freeIntervals, occupiedFrontRects, type RectMm } from './chassisSpec';
import { inferDeviceKind } from './deviceKind';
import { skirtGeometry, ventLayout } from './parametricGeometry';
import { styleFor } from './stylePresets';
import { defineDevice, type DeviceSeed } from '../definitions/defineDevice';
import { GENERIC_DEVICES } from '../definitions/generic';
import { UBIQUITI_DEVICES } from '../definitions/ubiquiti';

const proMax = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-usw-pro-max-24-poe')!;
const generic = (id: string) => GENERIC_DEVICES.find((d) => d.id === id)!;

const seed = (over: Partial<DeviceSeed> & { id: string }) =>
  defineDevice({
    slug: over.id,
    manufacturer: 'generic',
    manufacturerName: 'Generic',
    productName: 'Test Device',
    modelNumber: 'TD-1',
    category: 'accessories',
    rackUnits: 1,
    depthMm: 300,
    weightKg: 1,
    powerConsumptionWatts: 10,
    maximumPowerWatts: 20,
    description: '',
    presentation: { faceplate: 'server', tone: 'dark' },
    ...over,
  });

/* ---- kind inference --------------------------------------------------- */

describe('device kind inference', () => {
  it('resolves the whole generic accessory catalog without a generic cube', () => {
    expect(inferDeviceKind(generic('gen-patch-24'))).toBe('patch-panel');
    expect(inferDeviceKind(generic('gen-patch-48'))).toBe('patch-panel');
    expect(inferDeviceKind(generic('gen-blank-1u'))).toBe('blank-panel');
    expect(inferDeviceKind(generic('gen-brush-1u'))).toBe('brush-panel');
    expect(inferDeviceKind(generic('gen-finger-duct-2u'))).toBe('cable-manager');
    expect(inferDeviceKind(generic('gen-cable-ring-1u'))).toBe('cable-manager');
    expect(inferDeviceKind(generic('gen-vertical-mgmt-4u'))).toBe('cable-manager');
    expect(inferDeviceKind(generic('gen-cable-tray-1u'))).toBe('cable-manager');
  });

  it('classifies active gear by category and keywords', () => {
    expect(inferDeviceKind(proMax)).toBe('switch');
    expect(
      inferDeviceKind(seed({ id: 't-router', category: 'routing' })),
    ).toBe('router');
    expect(
      inferDeviceKind(seed({ id: 't-server', category: 'servers' })),
    ).toBe('server');
    expect(
      inferDeviceKind(seed({ id: 't-storage', category: 'storage' })),
    ).toBe('storage');
    expect(
      inferDeviceKind(
        seed({ id: 't-nas', category: 'storage', productName: 'RackStation NAS' }),
      ),
    ).toBe('nas');
    expect(
      inferDeviceKind(
        seed({ id: 't-fw', category: 'routing', productName: 'Edge Firewall' }),
      ),
    ).toBe('firewall');
    expect(
      inferDeviceKind(
        seed({ id: 't-gw', category: 'routing', productName: 'Security Gateway' }),
      ),
    ).toBe('gateway');
    expect(
      inferDeviceKind(
        seed({ id: 't-ups', category: 'power', presentation: { faceplate: 'ups', tone: 'dark' } }),
      ),
    ).toBe('ups');
    expect(
      inferDeviceKind(
        seed({ id: 't-pdu', category: 'power', productName: 'Metered PDU' }),
      ),
    ).toBe('pdu');
    expect(
      inferDeviceKind(
        seed({ id: 't-mc', category: 'accessories', productName: 'Gigabit Media Converter' }),
      ),
    ).toBe('media-converter');
    expect(
      inferDeviceKind(
        seed({ id: 't-modem', category: 'routing', productName: 'DOCSIS Modem' }),
      ),
    ).toBe('modem');
  });

  it('shelves and drawers resolve from accessory kind + name', () => {
    expect(
      inferDeviceKind(seed({ id: 't-shelf', accessoryKind: 'cantilever-shelf' })),
    ).toBe('shelf');
    expect(
      inferDeviceKind(
        seed({
          id: 't-drawer',
          accessoryKind: 'fixed-shelf',
          productName: 'Rack Drawer 2U',
        }),
      ),
    ).toBe('drawer');
  });

  it('fiber patch panels split from copper ones', () => {
    expect(
      inferDeviceKind(
        seed({
          id: 't-fiber',
          accessoryKind: 'patch-panel',
          productName: 'LC Fiber Panel',
          tags: ['fiber'],
        }),
      ),
    ).toBe('fiber-panel');
  });
});

/* ---- style presets ---------------------------------------------------- */

describe('manufacturer style presets', () => {
  it('matches brands case-insensitively and by substring', () => {
    expect(styleFor('Ubiquiti Inc.', 'dark').id).toBe('ubiquiti');
    expect(styleFor('CISCO Systems', 'dark').id).toBe('cisco');
    expect(styleFor('Hewlett Packard Enterprise', 'dark').id).toBe('hpe');
    expect(styleFor('MikroTik', 'dark').id).toBe('mikrotik');
    expect(styleFor('APC by Schneider', 'dark').id).toBe('apc');
  });

  it('unknown manufacturers fall back by presentation tone', () => {
    expect(styleFor('Acme Networks', 'dark').id).toBe('generic-dark');
    expect(styleFor('Acme Networks', 'metal').id).toBe('generic-metal');
  });
});

/* ---- chassis spec ----------------------------------------------------- */

const overlaps = (a: RectMm, b: RectMm): boolean =>
  Math.abs(a.xMm - b.xMm) < (a.wMm + b.wMm) / 2 &&
  Math.abs(a.yMm - b.yMm) < (a.hMm + b.hMm) / 2;

describe('chassis spec builder', () => {
  it('a rack switch gets ears with the EIA hole count and a badge', () => {
    const spec = buildChassisSpec(proMax);
    expect(spec.bodyStyle).toBe('box');
    expect(spec.ears).toEqual({ widthMm: 16, holeCount: 3 });
    expect(spec.badge).not.toBeNull();
    expect(spec.label).not.toBeNull();
    // Rear PSU frame around the resolved C14 inlet.
    expect(spec.psuFramesMm.length).toBeGreaterThan(0);
  });

  it('generated front furniture never collides with ports or display', () => {
    const occupied = occupiedFrontRects(proMax);
    const spec = buildChassisSpec(proMax);
    for (const vent of spec.vents.filter((v) => v.face === 'front')) {
      for (const rect of occupied) expect(overlaps(vent, rect)).toBe(false);
    }
    for (const bay of spec.driveBays) {
      for (const rect of occupied) expect(overlaps(bay, rect)).toBe(false);
    }
  });

  it('blank panels stay clean: no badge, no vents, panel body', () => {
    const spec = buildChassisSpec(generic('gen-blank-1u'));
    expect(spec.bodyStyle).toBe('panel');
    expect(spec.badge).toBeNull();
    expect(spec.vents).toHaveLength(0);
    expect(spec.driveBays).toHaveLength(0);
  });

  it('patch panels grow one recessed band per keystone row', () => {
    const p24 = buildChassisSpec(generic('gen-patch-24'));
    expect(p24.bodyStyle).toBe('panel');
    expect(p24.patchRows.length).toBeGreaterThanOrEqual(1);
    const p48 = buildChassisSpec(generic('gen-patch-48'));
    expect(p48.patchRows.length).toBeGreaterThan(p24.patchRows.length - 1);
  });

  it('brush panels carry a brush strip', () => {
    const spec = buildChassisSpec(generic('gen-brush-1u'));
    expect(spec.brush).not.toBeNull();
  });

  it('cable managers derive their furniture from the management spec', () => {
    const duct = buildChassisSpec(generic('gen-finger-duct-2u'));
    expect(duct.fingers).not.toBeNull();
    expect(duct.fingers!.cover).toBe(true);
    expect(duct.openBody).toBe('frame');

    const rings = buildChassisSpec(generic('gen-cable-ring-1u'));
    expect(rings.rings).toHaveLength(2);

    const vertical = buildChassisSpec(generic('gen-vertical-mgmt-4u'));
    expect(vertical.fingers?.axis).toBe('y');

    const tray = buildChassisSpec(generic('gen-cable-tray-1u'));
    expect(tray.openBody).toBe('tray');

    const raceway = buildChassisSpec(generic('gen-power-raceway-1u'));
    expect(raceway.openBody).toBe('raceway');
  });

  it('servers fill the free faceplate with drive bays; 2U grows rows and handles', () => {
    const u1 = buildChassisSpec(seed({ id: 't-srv1', category: 'servers' }));
    expect(u1.driveBays.length).toBeGreaterThanOrEqual(3);
    expect(u1.handles).toHaveLength(0);

    const u2 = buildChassisSpec(
      seed({ id: 't-srv2', category: 'servers', rackUnits: 2 }),
    );
    expect(u2.driveBays.length).toBeGreaterThan(u1.driveBays.length);
    expect(u2.handles).toHaveLength(2);
  });

  it('shelves and drawers produce a deck', () => {
    const shelf = buildChassisSpec(
      seed({ id: 't-shelf2', accessoryKind: 'cantilever-shelf', powerConsumptionWatts: 0, maximumPowerWatts: 0 }),
    );
    expect(shelf.deck?.drawer).toBe(false);
    expect(shelf.openBody).toBe('deck');

    const drawer = buildChassisSpec(
      seed({
        id: 't-drawer2',
        accessoryKind: 'fixed-shelf',
        productName: 'Lockable Rack Drawer',
        powerConsumptionWatts: 0,
        maximumPowerWatts: 0,
      }),
    );
    expect(drawer.deck?.drawer).toBe(true);
    // Drawers keep a closed face: no perforation, no cable slots.
    expect(drawer.deck?.perforated).toBe(false);
    expect(drawer.deck?.slotsMm).toHaveLength(0);
  });

  it('the Ubiquiti toolless shelf gets the full cantilever treatment', () => {
    const shelf = UBIQUITI_DEVICES.find((d) => d.id === 'ubnt-rack-shelf-1u')!;
    expect(inferDeviceKind(shelf)).toBe('shelf');
    const spec = buildChassisSpec(shelf);
    // Brushed-silver brand preset, EIA ears, perforated deck.
    expect(spec.style.id).toBe('ubiquiti');
    expect(spec.ears).toEqual({ widthMm: 16, holeCount: 3 });
    expect(spec.deck?.perforated).toBe(true);
    // Four oblong cable slots, one per corner, inside the deck bounds.
    expect(spec.deck?.slotsMm).toHaveLength(4);
    for (const slot of spec.deck!.slotsMm) {
      expect(Math.abs(slot.xMm) + slot.wMm / 2).toBeLessThan(shelf.widthMm / 2);
      expect(Math.abs(slot.yMm) + slot.hMm / 2).toBeLessThan(shelf.depthMm / 2);
    }
    // Passive steel: no vents, no buttons, no PSU frames.
    expect(spec.vents).toHaveLength(0);
    expect(spec.buttons).toHaveLength(0);
    expect(spec.psuFramesMm).toHaveLength(0);
  });

  it('PDUs without authored outlets get a visual outlet strip', () => {
    const pdu = buildChassisSpec(
      seed({ id: 't-pdu2', category: 'power', productName: 'Basic PDU' }),
    );
    expect(pdu.outletStrip).not.toBeNull();
  });

  it('desktop devices stand on rubber feet instead of ears', () => {
    const desktop = buildChassisSpec(
      seed({
        id: 't-desk',
        category: 'routing',
        mountingStandard: 'none',
        widthMm: 220,
        heightMm: 40,
        depthMm: 160,
      }),
    );
    expect(desktop.ears).toBeNull();
    expect(desktop.feetMm).toHaveLength(4);
  });

  it('metadata changes regenerate the spec (live updates)', () => {
    const base = seed({ id: 't-live', category: 'servers', rackUnits: 1 });
    const grown = { ...base, rackUnits: 4, heightMm: 4 * 43.7 };
    const a = buildChassisSpec(base);
    const b = buildChassisSpec(grown);
    expect(b.driveBays.length).toBeGreaterThan(a.driveBays.length);
    expect(b.ears!.holeCount).toBe(12);
  });
});

describe('cantilever skirt geometry orientation', () => {
  it('is full height at the front (z = 0) and a thin tail at the rear', () => {
    const geometry = skirtGeometry(43.7, 260);
    const position = geometry.getAttribute('position');
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < position.count; i++) minZ = Math.min(minZ, position.getZ(i));
    for (let i = 0; i < position.count; i++) maxZ = Math.max(maxZ, position.getZ(i));
    // Front edge at z = 0, running rearward (negative z).
    expect(maxZ).toBeCloseTo(0, 5);
    expect(minZ).toBeLessThan(-0.2);

    const heightSpan = (zLo: number, zHi: number) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < position.count; i++) {
        const z = position.getZ(i);
        if (z < zLo || z > zHi) continue;
        lo = Math.min(lo, position.getY(i));
        hi = Math.max(hi, position.getY(i));
      }
      return hi - lo;
    };
    const frontSpan = heightSpan(-0.02, 0);
    const rearSpan = heightSpan(minZ, minZ + 0.02);
    // Tall at the front, thin tail at the rear — never the reverse.
    expect(frontSpan).toBeGreaterThan(0.03);
    expect(rearSpan).toBeLessThan(0.015);
    // Thickness extrudes along +X only.
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
    }
    expect(minX).toBeCloseTo(0, 5);
    expect(maxX).toBeCloseTo(0.0022, 5);
  });
});

/* ---- layout helpers --------------------------------------------------- */

describe('layout helpers', () => {
  it('freeIntervals subtracts occupied spans from the lane', () => {
    const occupied: RectMm[] = [
      { xMm: 0, yMm: 0, wMm: 100, hMm: 20 },
      { xMm: 150, yMm: 0, wMm: 40, hMm: 20 },
      { xMm: 0, yMm: 200, wMm: 500, hMm: 20 }, // other lane — ignored
    ];
    const free = freeIntervals(occupied, { yMm: 0, hMm: 20 }, 200, 4);
    expect(free.length).toBe(3);
    expect(free[0][1]).toBeCloseTo(-54, 5);
    expect(free[1]).toEqual([54, 126]);
    expect(free[2]).toEqual([174, 200]);
  });

  it('vent layouts stay bounded and inside their region', () => {
    for (const style of ['slots', 'hex', 'holes', 'grille'] as const) {
      const region = { xMm: 0, yMm: 0, wMm: 380, hMm: 26 };
      const layout = ventLayout(region, style);
      expect(layout.offsets.length).toBeGreaterThan(0);
      expect(layout.offsets.length).toBeLessThanOrEqual(360);
      for (const [x, y] of layout.offsets) {
        expect(Math.abs(x)).toBeLessThanOrEqual(region.wMm / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(region.hMm / 2);
      }
    }
  });

  it('hex staggers odd rows; slots are vertical bars', () => {
    const hex = ventLayout({ xMm: 0, yMm: 0, wMm: 60, hMm: 30 }, 'hex');
    expect(hex.round).toBe(true);
    const rows = new Set(hex.offsets.map(([, y]) => Math.round(y * 10)));
    expect(rows.size).toBeGreaterThan(1);

    const slots = ventLayout({ xMm: 0, yMm: 0, wMm: 100, hMm: 20 }, 'slots');
    expect(slots.round).toBe(false);
    expect(slots.slotHMm).toBeGreaterThan(slots.slotWMm);
  });
});
