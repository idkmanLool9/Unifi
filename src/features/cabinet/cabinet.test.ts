import { describe, expect, it } from 'vitest';
import {
  matchesNodePattern,
  partForNode,
  type CabinetModelDef,
} from './cabinetSchema';
import {
  closeAllDoors,
  computePartTarget,
  defaultInstance,
  hideAllPanels,
  interiorParts,
  maintenanceParts,
  opacityFor,
  openAllDoors,
  restoreParts,
  type PartRuntime,
} from './cabinetRuntime';
import { cabinetModelForProfile, getCabinetModel } from './cabinetModels';

const MODEL = getCabinetModel('uacc-wall-12u-600')!;
const DEG = Math.PI / 180;

const norm = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);

describe('node pattern matching', () => {
  it('matches exact names and prefix globs', () => {
    expect(matchesNodePattern('Cab-Side-L', 'Cab-Side-L')).toBe(true);
    expect(matchesNodePattern('Cab-Side-R', 'Cab-Side-L')).toBe(false);
    expect(matchesNodePattern('INT_Rail_FL', 'INT_Rail_*')).toBe(true);
    expect(matchesNodePattern('INT_Bracket_A', 'INT_Rail_*')).toBe(false);
  });

  it('resolves a node to the first (most specific) owning part', () => {
    // The door-side hinge leaf belongs to the door, not the frame catch-all,
    // because the door part is listed first.
    expect(partForNode(MODEL, 'Hinge-0-LeafD')?.id).toBe('front-door');
    // The static (cabinet-side) hinge knuckle falls through to the frame.
    expect(partForNode(MODEL, 'Hinge-0-LeafC')?.id).toBe('frame');
    expect(partForNode(MODEL, 'Cab-Side-L')?.id).toBe('side-left');
    expect(partForNode(MODEL, 'INT_Rail_FR')?.id).toBe('rails');
    expect(partForNode(MODEL, 'nonexistent-node')).toBeUndefined();
  });

  it('every part claims at least one authored node pattern', () => {
    for (const part of MODEL.parts) {
      expect(part.nodes.length).toBeGreaterThan(0);
    }
  });
});

describe('profile → cabinet mapping', () => {
  it('maps the UACC wall profile to its model and open frames to none', () => {
    expect(cabinetModelForProfile('uacc-wall-12u')?.id).toBe(MODEL.id);
    expect(cabinetModelForProfile('open-frame-700')).toBeUndefined();
  });
});

describe('defaultInstance', () => {
  it('seeds every part in its authored default state', () => {
    const inst = defaultInstance(MODEL);
    expect(inst.mode).toBe('normal');
    expect(inst.transparency).toBe('off');
    expect(inst.animationSpeed).toBe(1);
    for (const part of MODEL.parts) {
      expect(inst.parts[part.id].state).toBe(part.defaultState);
    }
  });
});

describe('computePartTarget', () => {
  const normal = { mode: 'normal', transparency: 'off' } as const;
  const door = MODEL.parts.find((p) => p.id === 'front-door')!;
  const side = MODEL.parts.find((p) => p.id === 'side-left')!;
  const frame = MODEL.parts.find((p) => p.id === 'frame')!;

  it('hinge: closed door has zero rotation, open door swings to openDeg', () => {
    const closed = computePartTarget(door, { state: 'closed' }, normal);
    expect(closed.hingeRad).toBeCloseTo(0);
    expect(closed.visible).toBe(true);

    const open = computePartTarget(door, { state: 'open' }, normal);
    expect(open.hingeRad).toBeCloseTo(door.hinge!.openDeg * DEG);
  });

  it('hinge: an angle override wins over the authored open angle', () => {
    const rt: PartRuntime = { state: 'open', angleDeg: 45 };
    expect(computePartTarget(door, rt, normal).hingeRad).toBeCloseTo(45 * DEG);
  });

  it('remove: removed panel translates clear along its move vector', () => {
    const removed = computePartTarget(side, { state: 'removed' }, normal);
    const dist = norm(removed.offset);
    expect(dist).toBeCloseTo((side.move!.distanceMm * 0.001));
    // Left panel travels toward -X.
    expect(removed.offset[0]).toBeLessThan(0);
    expect(removed.visible).toBe(true);
  });

  it('remove/lift: hidden panel becomes invisible with no offset', () => {
    const hidden = computePartTarget(side, { state: 'hidden' }, normal);
    expect(hidden.visible).toBe(false);
    expect(norm(hidden.offset)).toBeCloseTo(0);
  });

  it('visibility: hidden frame is invisible, installed is visible', () => {
    expect(
      computePartTarget(frame, { state: 'hidden' }, normal).visible,
    ).toBe(false);
    expect(
      computePartTarget(frame, { state: 'installed' }, normal).visible,
    ).toBe(true);
  });

  it('exploded: parts fan outward without touching their saved state', () => {
    const exploded = { mode: 'exploded', transparency: 'off' } as const;
    // Door stays closed (state) but still offsets outward in explode view.
    const t = computePartTarget(door, { state: 'closed' }, exploded);
    expect(norm(t.offset)).toBeCloseTo(door.explode!.distanceMm * 0.001);
    expect(t.hingeRad).toBeCloseTo(0);
    expect(t.visible).toBe(true);
  });
});

describe('transparency', () => {
  const side = MODEL.parts.find((p) => p.id === 'side-left')!;
  const frame = MODEL.parts.find((p) => p.id === 'frame')!;

  it('dims only parts that support transparency', () => {
    expect(opacityFor(side, undefined, 'p50')).toBeCloseTo(0.5);
    // Frame has no supportsTransparency flag → stays opaque.
    expect(opacityFor(frame, undefined, 'ghost')).toBe(1);
  });

  it('off mode and a per-part override behave as specified', () => {
    expect(opacityFor(side, undefined, 'off')).toBe(1);
    expect(opacityFor(side, { state: 'installed', opacityPct: 40 }, 'off')).toBeCloseTo(0.4);
  });
});

describe('quick-action presets', () => {
  it('openAllDoors / closeAllDoors flip only hinge parts', () => {
    const base = defaultInstance(MODEL).parts;
    const opened = openAllDoors(MODEL, base);
    expect(opened['front-door'].state).toBe('open');
    expect(opened['side-left'].state).toBe('installed'); // untouched
    const closed = closeAllDoors(MODEL, opened);
    expect(closed['front-door'].state).toBe('closed');
  });

  it('hideAllPanels hides every part that offers a hidden state', () => {
    const hidden = hideAllPanels(MODEL, defaultInstance(MODEL).parts);
    for (const part of MODEL.parts) {
      if (part.states.includes('hidden')) {
        expect(hidden[part.id].state).toBe('hidden');
      }
    }
  });

  it('restoreParts returns every part to its authored default', () => {
    const restored = restoreParts(MODEL);
    for (const part of MODEL.parts) {
      expect(restored[part.id].state).toBe(part.defaultState);
    }
  });

  it('interior preset clears obstructing parts only', () => {
    const parts = interiorParts(MODEL, defaultInstance(MODEL).parts);
    expect(parts['front-door'].state).toBe('open'); // obstructs, hinge
    expect(parts['side-left'].state).toBe('removed'); // obstructs, removable
    expect(parts['top-cover'].state).toBe('installed'); // not obstructing
  });

  it('maintenance preset opens doors and removes side panels + top', () => {
    const parts = maintenanceParts(MODEL, defaultInstance(MODEL).parts);
    expect(parts['front-door'].state).toBe('open');
    expect(parts['side-left'].state).toBe('removed');
    expect(parts['side-right'].state).toBe('removed');
    expect(parts['top-cover'].state).toBe('removed');
    expect(parts['rails'].state).toBe('installed'); // hardware stays visible
  });
});

describe('model integrity', () => {
  const model: CabinetModelDef = MODEL;
  it('part ids are unique', () => {
    const ids = model.parts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('hinge parts declare a hinge; move parts declare a move', () => {
    for (const p of model.parts) {
      if (p.interaction === 'hinge') expect(p.hinge).toBeDefined();
      if (p.interaction === 'remove' || p.interaction === 'lift') {
        expect(p.move).toBeDefined();
      }
    }
  });
});
