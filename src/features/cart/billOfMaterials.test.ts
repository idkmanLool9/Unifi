import { describe, expect, it } from 'vitest';
import { computeBom, type BomDeviceInfo } from './billOfMaterials';
import { formatMoney } from '@/features/devices/pricing';
import type { PlacedDevice } from '@/features/rack/rackMath';
import type { RackConfig } from '@/types';

const rack: RackConfig = {
  id: 'rack-1',
  name: 'Test Rack',
  profileId: 'open-frame-700', // priced at $249
  railMode: 'manual',
  railSpacingMm: 700,
  units: 12,
  finish: 'steel',
  orientation: 'front',
  showUnitNumbers: true,
  showRearPosts: true,
  showFloorMarker: true,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const CATALOG: Record<string, BomDeviceInfo> = {
  'ubnt-udm-pro': {
    id: 'ubnt-udm-pro',
    productName: 'Dream Machine Pro',
    manufacturerName: 'Ubiquiti',
  }, // $379
  'ubnt-unvr': {
    id: 'ubnt-unvr',
    productName: 'UNVR',
    manufacturerName: 'Ubiquiti',
  }, // $499
  mystery: {
    id: 'mystery',
    productName: 'Mystery Box',
    manufacturerName: 'ACME',
  }, // no price
};
const resolve = (id: string) => CATALOG[id];

const inst = (definitionId: string, startU: number): PlacedDevice => ({
  id: `${definitionId}-${startU}`,
  definitionId,
  startU,
  facing: 'front',
  visible: true,
});

describe('computeBom', () => {
  it('is empty with no rack and no devices', () => {
    const bom = computeBom(null, [], resolve);
    expect(bom.lines).toHaveLength(0);
    expect(bom.subtotalUsd).toBe(0);
    expect(bom.itemCount).toBe(0);
    expect(bom.hasUnpriced).toBe(false);
  });

  it('adds the rack/enclosure as its own priced line', () => {
    const bom = computeBom(rack, [], resolve);
    expect(bom.lines).toHaveLength(1);
    const line = bom.lines[0];
    expect(line.kind).toBe('rack');
    expect(line.qty).toBe(1);
    expect(line.unitUsd).toBe(249);
    expect(line.lineUsd).toBe(249);
    expect(bom.subtotalUsd).toBe(249);
    expect(bom.itemCount).toBe(1);
  });

  it('groups identical devices into one quantity line and totals them', () => {
    const bom = computeBom(
      rack,
      [inst('ubnt-udm-pro', 1), inst('ubnt-unvr', 3), inst('ubnt-unvr', 5)],
      resolve,
    );
    // rack + 2 device lines (udm ×1, unvr ×2)
    expect(bom.lines).toHaveLength(3);
    const unvr = bom.lines.find((l) => l.key === 'device:ubnt-unvr')!;
    expect(unvr.qty).toBe(2);
    expect(unvr.unitUsd).toBe(499);
    expect(unvr.lineUsd).toBe(998);
    // 249 rack + 379 udm + 998 unvr
    expect(bom.subtotalUsd).toBe(249 + 379 + 998);
    expect(bom.itemCount).toBe(1 + 1 + 2);
    expect(bom.hasUnpriced).toBe(false);
  });

  it('flags unpriced items and excludes them from the total', () => {
    const bom = computeBom(rack, [inst('mystery', 1)], resolve);
    const line = bom.lines.find((l) => l.key === 'device:mystery')!;
    expect(line.unitUsd).toBeUndefined();
    expect(line.lineUsd).toBeUndefined();
    expect(bom.hasUnpriced).toBe(true);
    // only the rack contributes to the subtotal
    expect(bom.subtotalUsd).toBe(249);
  });

  it('skips instances whose definition no longer resolves', () => {
    const bom = computeBom(rack, [inst('deleted-device', 1)], resolve);
    expect(bom.lines).toHaveLength(1); // just the rack
    expect(bom.lines[0].kind).toBe('rack');
  });
});

describe('formatMoney', () => {
  it('formats USD as the base currency, whole units', () => {
    expect(formatMoney(1099, 'USD')).toBe('$1,099');
  });

  it('converts to other display currencies', () => {
    // 100 USD × 0.92 = €92 (de-DE groups/spaces the symbol)
    expect(formatMoney(100, 'EUR')).toContain('92');
    expect(formatMoney(100, 'GBP')).toContain('79');
  });
});
