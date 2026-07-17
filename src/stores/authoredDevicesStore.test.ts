import { afterEach, describe, expect, it } from 'vitest';
import { applyAuthoredDefinitions } from './authoredDevicesStore';
import { getDevice, registerDevice } from '@/features/devices/deviceRegistry';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;

afterEach(() => {
  // Restore the built-in so other tests see the original definition.
  registerDevice(proMax);
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
