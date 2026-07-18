import { afterEach, describe, expect, it } from 'vitest';
import { applyAuthoredDefinitions } from './authoredDevicesStore';
import {
  getDevice,
  registerDevice,
  resetDeviceToBuiltin,
} from '@/features/devices/deviceRegistry';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';
import { GENERIC_DEVICES } from '@/features/devices/definitions/generic';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;
const patch24 = GENERIC_DEVICES.find((d) => d.id === 'gen-patch-24')!;

afterEach(() => {
  // Restore the built-ins so other tests see the original definitions.
  registerDevice(proMax);
  resetDeviceToBuiltin(patch24.id);
});

describe('authored device persistence', () => {
  it('applies valid stored definitions over the registry', () => {
    const authored = JSON.parse(JSON.stringify(proMax)) as Record<
      string,
      unknown
    >;
    authored.portsAuthored = true;
    authored.ports = [
      {
        id: 'lan-1',
        type: 'rj45',
        count: 1,
        positionMm: [0, 0, 162.5],
        location: 'front',
      },
    ];

    const applied = applyAuthoredDefinitions({ [proMax.id]: authored });
    expect(applied).toBe(1);
    const live = getDevice(proMax.id)!;
    expect(live.portsAuthored).toBe(true);
    expect(live.ports).toHaveLength(1);
    expect(live.ports[0].id).toBe('lan-1');
  });

  it('re-grafts rear pass-through openings onto an older authored patch panel', () => {
    // A copy saved before the feed-through feature: front openings only.
    const authored = JSON.parse(JSON.stringify(patch24)) as Record<
      string,
      unknown
    >;
    authored.ports = (authored.ports as Array<{ location?: string }>).filter(
      (p) => (p.location ?? 'front') !== 'rear',
    );
    expect((authored.ports as unknown[]).length).toBe(1);

    const applied = applyAuthoredDefinitions({ [patch24.id]: authored });
    expect(applied).toBe(1);
    const live = getDevice(patch24.id)!;
    // The rear keystone group the catalog now ships is restored.
    const rear = live.ports.filter((p) => p.location === 'rear');
    expect(rear).toHaveLength(1);
    expect(rear[0].id).toBe('keystone-rear');
    expect(rear[0].count).toBe(24);
  });

  it('skips invalid or mismatched records without touching the registry', () => {
    const before = getDevice(proMax.id);
    const applied = applyAuthoredDefinitions({
      [proMax.id]: { id: 'wrong-id' },
      garbage: 42,
    });
    expect(applied).toBe(0);
    expect(getDevice(proMax.id)).toBe(before);
  });
});
