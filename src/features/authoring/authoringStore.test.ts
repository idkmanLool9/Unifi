import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthoringStore } from './authoringStore';
import { primeCalibration } from '@/features/devices/hardware/connectorCalibration';
import { devicePlacement, rackGeometry } from '@/features/rack/rackMath';
import { UBIQUITI_DEVICES } from '@/features/devices/definitions/ubiquiti';

const proMax = UBIQUITI_DEVICES.find(
  (d) => d.id === 'ubnt-usw-pro-max-24-poe',
)!;
const GEO = rackGeometry('open-frame-700');

beforeEach(() => {
  primeCalibration(proMax.id, null);
  useAuthoringStore.getState().close();
  useAuthoringStore.getState().open(proMax.id);
});

describe('mount offset placement', () => {
  it('applies the authored mount correction in device-local space', () => {
    const base = devicePlacement(proMax, 3, 'front', GEO);
    const corrected = devicePlacement(
      { ...proMax, mountOffsetMm: [2, -1.5, 4] },
      3,
      'front',
      GEO,
    );
    expect(corrected.position[0] - base.position[0]).toBeCloseTo(0.002, 6);
    expect(corrected.position[1] - base.position[1]).toBeCloseTo(-0.0015, 6);
    expect(corrected.position[2] - base.position[2]).toBeCloseTo(0.004, 6);

    // Rear-facing devices mirror the lateral/depth correction.
    const rearBase = devicePlacement(proMax, 3, 'rear', GEO);
    const rear = devicePlacement(
      { ...proMax, mountOffsetMm: [2, -1.5, 4] },
      3,
      'rear',
      GEO,
    );
    expect(rear.position[0] - rearBase.position[0]).toBeCloseTo(-0.002, 6);
    expect(rear.position[2] - rearBase.position[2]).toBeCloseTo(-0.004, 6);
  });
});

describe('undo / redo', () => {
  it('round-trips port mutations', () => {
    const store = useAuthoringStore.getState;
    const before = store().ports.length;

    store().addPort('rj45');
    expect(store().ports.length).toBe(before + 1);

    store().undo();
    expect(store().ports.length).toBe(before);

    store().redo();
    expect(store().ports.length).toBe(before + 1);
  });

  it('covers delete — nothing orphaned, fully restorable', () => {
    const store = useAuthoringStore.getState;
    const all = store().ports.map((p) => p.id);
    store().selectMany(all);
    store().deleteSelection();
    expect(store().ports.length).toBe(0);

    store().undo();
    expect(store().ports.map((p) => p.id)).toEqual(all);
  });

  it('covers mount offset edits', () => {
    const store = useAuthoringStore.getState;
    store().setMountOffset([0, 0, 3]);
    expect(store().mountOffsetMm).toEqual([0, 0, 3]);
    store().undo();
    expect(store().mountOffsetMm).toEqual([0, 0, 0]);
    store().redo();
    expect(store().mountOffsetMm).toEqual([0, 0, 3]);
  });

  it('a new edit clears the redo branch', () => {
    const store = useAuthoringStore.getState;
    const baseCount = store().ports.length;
    store().addPort('rj45');
    store().undo();
    store().addPort('sfp+');
    const afterEdit = store().ports.length;
    expect(afterEdit).toBe(baseCount + 1);
    store().redo(); // redo branch was cleared — must be a no-op
    expect(store().ports.length).toBe(afterEdit);
    expect(store().future).toHaveLength(0);
  });
});

describe('suggestion lifecycle', () => {
  it('rejecting removes everything and never resurfaces on refresh', () => {
    const store = useAuthoringStore.getState;
    // Simulate an offered analysis.
    useAuthoringStore.setState({
      suggestions: [
        {
          id: 'rj45-99',
          type: 'rj45',
          location: 'front',
          positionMm: [0, 0, 163],
          rotationDeg: [0, 0, 0],
          sizeMm: [15, 13],
          poe: false,
          etherlighting: false,
          visible: true,
          anchorMm: [0, 0, 22],
        },
      ],
      suggestionsDecided: false,
    });

    store().rejectSuggestions();
    expect(store().suggestions).toBeNull();
    expect(store().suggestionsDecided).toBe(true);

    // Reloads / calibration bumps must not bring them back.
    store().refreshSuggestions();
    expect(store().suggestions).toBeNull();
    // And rejection leaves the authored ports untouched.
    expect(store().ports.length).toBeGreaterThan(0);
  });
});
