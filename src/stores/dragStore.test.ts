import { beforeEach, describe, expect, it } from 'vitest';
import { useDragStore } from './dragStore';
import { useDeviceInstancesStore } from './deviceInstancesStore';
import { useRackStore } from './rackStore';
import { useSelectionStore } from './selectionStore';

function seedRack(units: 6 | 9 | 12 = 9) {
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

const target = (startU: number, facing: 'front' | 'rear' = 'front') => ({
  rackId: 'rack-1',
  startU,
  facing,
});

const OK = (startU: number) => ({ ok: true as const, startU });

beforeEach(() => {
  useDragStore.setState({
    phase: 'idle',
    source: null,
    target: null,
    validation: null,
    precise: false,
    suppressClickUntil: 0,
    pointer: { x: 0, y: 0 },
  });
  useDeviceInstancesStore.setState({ instances: [] });
  useSelectionStore.setState({ selection: null });
  useRackStore.setState({ rack: null });
  seedRack();
});

describe('drag lifecycle', () => {
  it('begin -> cancel restores a clean idle state', () => {
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 10, y: 10 });
    useDragStore.getState().setTarget(target(3), OK(3));
    useDragStore.getState().cancel();

    const after = useDragStore.getState();
    expect(after.phase).toBe('idle');
    expect(after.source).toBeNull();
    expect(after.target).toBeNull();
    expect(after.validation).toBeNull();
    expect(useDeviceInstancesStore.getState().instances).toHaveLength(0);
  });

  it('cancel suppresses the click that ended the gesture', () => {
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 0, y: 0 });
    drag.cancel();
    expect(useDragStore.getState().suppressClickUntil).toBeGreaterThan(
      performance.now(),
    );
  });
});

describe('library drops', () => {
  it('a valid drop creates exactly one selected instance', () => {
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 0, y: 0 });
    useDragStore.getState().setTarget(target(3, 'rear'), OK(3));
    const outcome = useDragStore.getState().drop();

    const instances = useDeviceInstancesStore.getState().instances;
    expect(outcome.committed).toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({ startU: 3, facing: 'rear' });
    expect(useSelectionStore.getState().selection).toEqual({
      kind: 'device',
      instanceId: instances[0].id,
    });
    expect(useDragStore.getState().phase).toBe('idle');
  });

  it('a drop without a target creates nothing', () => {
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 0, y: 0 });
    const outcome = useDragStore.getState().drop();
    expect(outcome.committed).toBe(false);
    expect(useDeviceInstancesStore.getState().instances).toHaveLength(0);
  });

  it('a drop on an invalid slot creates nothing', () => {
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 0, y: 0 });
    useDragStore.getState().setTarget(target(4), {
      ok: false,
      reason: 'occupied',
      message: 'U4 is already occupied by another device.',
    });
    const outcome = useDragStore.getState().drop();
    expect(outcome.committed).toBe(false);
    expect(useDeviceInstancesStore.getState().instances).toHaveLength(0);
    expect(useDragStore.getState().phase).toBe('idle');
  });

  it('re-validates at commit: a stale ok target still cannot double-book', () => {
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 3);
    const drag = useDragStore.getState();
    drag.begin({ kind: 'library', definitionId: 'ubnt-udm-pro' }, { x: 0, y: 0 });
    // Validation claims ok (stale), but the slot is occupied.
    useDragStore.getState().setTarget(target(3), OK(3));
    const outcome = useDragStore.getState().drop();
    expect(outcome.committed).toBe(false);
    expect(useDeviceInstancesStore.getState().instances).toHaveLength(1);
  });
});

describe('transactional moves', () => {
  it('moving commits only on drop, updating U and facing', () => {
    const add = useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 2);
    expect(add.ok).toBe(true);
    const id = useDeviceInstancesStore.getState().instances[0].id;

    const drag = useDragStore.getState();
    drag.begin(
      { kind: 'instance', instanceId: id, definitionId: 'ubnt-udm-pro', duplicate: false },
      { x: 0, y: 0 },
    );
    // Mid-drag the original is untouched.
    expect(useDeviceInstancesStore.getState().instances[0].startU).toBe(2);

    useDragStore.getState().setTarget(target(5, 'rear'), OK(5));
    const outcome = useDragStore.getState().drop();
    expect(outcome).toEqual({ committed: true, instanceId: id });
    expect(useDeviceInstancesStore.getState().instances[0]).toMatchObject({
      id,
      startU: 5,
      facing: 'rear',
    });
  });

  it('a failed move preserves the original placement exactly', () => {
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 2);
    useDeviceInstancesStore.getState().addDevice('ubnt-usw-pro-max-24-poe', 5);
    const id = useDeviceInstancesStore.getState().instances[0].id;

    const drag = useDragStore.getState();
    drag.begin(
      { kind: 'instance', instanceId: id, definitionId: 'ubnt-udm-pro', duplicate: false },
      { x: 0, y: 0 },
    );
    // Stale-ok target onto the occupied slot: commit re-validates.
    useDragStore.getState().setTarget(target(5), OK(5));
    const outcome = useDragStore.getState().drop();

    expect(outcome.committed).toBe(false);
    expect(useDeviceInstancesStore.getState().instances[0]).toMatchObject({
      id,
      startU: 2,
      facing: 'front',
    });
  });

  it('cancel during a move leaves the original untouched', () => {
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 2);
    const id = useDeviceInstancesStore.getState().instances[0].id;
    const drag = useDragStore.getState();
    drag.begin(
      { kind: 'instance', instanceId: id, definitionId: 'ubnt-udm-pro', duplicate: false },
      { x: 0, y: 0 },
    );
    useDragStore.getState().setTarget(target(7), OK(7));
    useDragStore.getState().cancel();
    expect(useDeviceInstancesStore.getState().instances[0].startU).toBe(2);
  });

  it('Alt-duplicate keeps the original and adds a copy', () => {
    useDeviceInstancesStore.getState().addDevice('ubnt-udm-pro', 2);
    const id = useDeviceInstancesStore.getState().instances[0].id;
    const drag = useDragStore.getState();
    drag.begin(
      { kind: 'instance', instanceId: id, definitionId: 'ubnt-udm-pro', duplicate: true },
      { x: 0, y: 0 },
    );
    useDragStore.getState().setTarget(target(6), OK(6));
    const outcome = useDragStore.getState().drop();

    const instances = useDeviceInstancesStore.getState().instances;
    expect(outcome.committed).toBe(true);
    expect(instances).toHaveLength(2);
    expect(instances[0]).toMatchObject({ id, startU: 2 });
    expect(instances[1]).toMatchObject({ startU: 6 });
    expect(instances[1].id).not.toBe(id);
  });
});
