import { beforeEach, describe, expect, it } from 'vitest';
import { useDeviceInstancesStore } from './deviceInstancesStore';
import { useRackStore } from './rackStore';
import { useSelectionStore } from './selectionStore';

function seedRack(units: 6 | 12 | 42 = 12) {
  useRackStore.setState({
    rack: {
      id: 'rack-1',
      name: 'Test Rack',
      profileId: 'open-frame-700',
      railMode: 'manual',
      railSpacingMm: 700,
      units,
      finish: 'graphite',
      orientation: 'front',
      showUnitNumbers: true,
      showRearPosts: true,
      showFloorMarker: true,
      createdAt: new Date().toISOString(),
    },
  });
}

beforeEach(() => {
  useDeviceInstancesStore.setState({ instances: [] });
  useSelectionStore.setState({ selection: null });
  useRackStore.setState({ rack: null });
});

describe('deviceInstancesStore', () => {
  it('refuses to mount without a rack', () => {
    const result = useDeviceInstancesStore
      .getState()
      .addDevice('ubnt-udm-pro');
    expect(result).toMatchObject({ ok: false, reason: 'no-rack' });
  });

  it('refuses unknown definitions', () => {
    seedRack();
    const result = useDeviceInstancesStore
      .getState()
      .addDevice('not-a-device');
    expect(result).toMatchObject({ ok: false, reason: 'unknown-device' });
  });

  it('auto-stacks devices from the bottom and selects the new instance', () => {
    seedRack();
    const store = useDeviceInstancesStore.getState();
    expect(store.addDevice('ubnt-udm-pro')).toEqual({ ok: true, startU: 1 });
    // 2U NVR lands on the next free slot.
    expect(
      useDeviceInstancesStore.getState().addDevice('ubnt-unvr-pro'),
    ).toEqual({ ok: true, startU: 2 });

    const instances = useDeviceInstancesStore.getState().instances;
    expect(instances).toHaveLength(2);
    expect(useSelectionStore.getState().selection).toEqual({
      kind: 'device',
      instanceId: instances[1].id,
    });
  });

  it('rejects devices deeper than the rack', () => {
    seedRack();
    const result = useDeviceInstancesStore.getState().addDevice('dell-r760');
    expect(result).toMatchObject({ ok: false, reason: 'too-deep' });
  });

  it('moves devices with validation', () => {
    seedRack();
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 1);
    useDeviceInstancesStore.getState().addDevice('ubnt-usw-pro-48-poe', 2);
    const [first, second] = useDeviceInstancesStore.getState().instances;

    // Onto an occupied slot → rejected, state unchanged.
    expect(
      useDeviceInstancesStore.getState().moveDevice(first.id, 2),
    ).toMatchObject({ ok: false, reason: 'occupied' });
    expect(
      useDeviceInstancesStore.getState().instances.find((i) => i.id === first.id)
        ?.startU,
    ).toBe(1);

    // To a free slot → moves.
    expect(useDeviceInstancesStore.getState().moveDevice(second.id, 8)).toEqual(
      { ok: true, startU: 8 },
    );
    expect(
      useDeviceInstancesStore
        .getState()
        .instances.find((i) => i.id === second.id)?.startU,
    ).toBe(8);
  });

  it('reports a full rack', () => {
    seedRack(6);
    const store = useDeviceInstancesStore.getState();
    for (let i = 0; i < 6; i++) {
      expect(store.addDevice('ubnt-udm-pro').ok).toBe(true);
    }
    expect(store.addDevice('ubnt-udm-pro')).toMatchObject({
      ok: false,
      reason: 'occupied',
    });
  });

  it('removes devices and clears their selection', () => {
    seedRack();
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro');
    const id = useDeviceInstancesStore.getState().instances[0].id;
    expect(useSelectionStore.getState().selection).toEqual({
      kind: 'device',
      instanceId: id,
    });

    useDeviceInstancesStore.getState().removeDevice(id);
    expect(useDeviceInstancesStore.getState().instances).toHaveLength(0);
    expect(useSelectionStore.getState().selection).toBeNull();
  });

  it('updates facing and visibility', () => {
    seedRack();
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro');
    const id = useDeviceInstancesStore.getState().instances[0].id;

    useDeviceInstancesStore.getState().setFacing(id, 'rear');
    useDeviceInstancesStore.getState().setVisible(id, false);

    const updated = useDeviceInstancesStore.getState().instances[0];
    expect(updated.facing).toBe('rear');
    expect(updated.visible).toBe(false);
  });
});
