import type {
  CabinetModelDef,
  CabinetPartDef,
  CabinetPartState,
  Vec3,
} from './cabinetSchema';

/**
 * Pure interaction logic for the cabinet system: default part states, the
 * quick-action presets, and — the core — turning a part's declarative
 * state into a concrete target transform (hinge angle, translation,
 * visibility, opacity). The renderer just eases toward these targets; all
 * of the "what should this part do" lives here and is unit-tested.
 */

export type CabinetMode = 'normal' | 'exploded' | 'interior' | 'maintenance';

export type TransparencyMode =
  | 'off'
  | 'p25'
  | 'p50'
  | 'p75'
  | 'ghost'
  | 'xray';

/** Persisted per-part runtime state. */
export interface PartRuntime {
  state: CabinetPartState;
  /** Hinge angle override, deg (doors). Falls back to the def's openDeg. */
  angleDeg?: number;
  /** Per-part opacity override, 0–100 (100 = opaque). */
  opacityPct?: number;
}

export interface CabinetInstance {
  mode: CabinetMode;
  /** Animation speed multiplier (1 = default, 2 = twice as fast). */
  animationSpeed: number;
  transparency: TransparencyMode;
  parts: Record<string, PartRuntime>;
}

const MM_TO_M = 0.001;
const DEG = Math.PI / 180;

/** Fresh instance with every part in its authored default state. */
export function defaultInstance(model: CabinetModelDef): CabinetInstance {
  const parts: Record<string, PartRuntime> = {};
  for (const p of model.parts) parts[p.id] = { state: p.defaultState };
  return { mode: 'normal', animationSpeed: 1, transparency: 'off', parts };
}

function normalize([x, y, z]: Vec3): Vec3 {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

/** The transparency-driven opacity for a part (1 = opaque). */
export function opacityFor(
  part: CabinetPartDef,
  runtime: PartRuntime | undefined,
  transparency: TransparencyMode,
): number {
  if (runtime?.opacityPct !== undefined) {
    return Math.min(1, Math.max(0, runtime.opacityPct / 100));
  }
  if (!part.supportsTransparency || transparency === 'off') return 1;
  switch (transparency) {
    case 'p25':
      return 0.75;
    case 'p50':
      return 0.5;
    case 'p75':
      return 0.25;
    case 'ghost':
      return 0.16;
    case 'xray':
      return 0.28;
    default:
      return 1;
  }
}

export interface PartTarget {
  visible: boolean;
  opacity: number;
  /** Hinge rotation about the part's axis, radians. */
  hingeRad: number;
  /** Translation from the model-local rest position, metres. */
  offset: Vec3;
}

/**
 * The concrete transform a part should ease toward, from its state and the
 * cabinet mode. Exploded view is a transient render override: every part
 * with an explode vector fans outward without touching its saved state, so
 * leaving the view restores exactly. Removed/hidden/open all derive here.
 */
export function computePartTarget(
  part: CabinetPartDef,
  runtime: PartRuntime | undefined,
  instance: Pick<CabinetInstance, 'mode' | 'transparency'>,
): PartTarget {
  const opacity = opacityFor(part, runtime, instance.transparency);
  const state = runtime?.state ?? part.defaultState;

  if (instance.mode === 'exploded') {
    const e = part.explode;
    const off: Vec3 = e
      ? (normalize(e.dirMm).map((c) => c * e.distanceMm * MM_TO_M) as Vec3)
      : [0, 0, 0];
    return { visible: true, opacity, hingeRad: 0, offset: off };
  }

  // Hinge doors: swing to the open angle (or the slider override).
  if (part.interaction === 'hinge' && part.hinge) {
    const deg = state === 'open' ? (runtime?.angleDeg ?? part.hinge.openDeg) : 0;
    return { visible: true, opacity, hingeRad: deg * DEG, offset: [0, 0, 0] };
  }

  // Slide / lift / remove: translate clear when removed, vanish when hidden.
  if (part.move && (part.interaction === 'remove' || part.interaction === 'lift' || part.interaction === 'sliding')) {
    if (state === 'removed') {
      const off = normalize(part.move.dirMm).map(
        (c) => c * part.move!.distanceMm * MM_TO_M,
      ) as Vec3;
      return { visible: true, opacity, hingeRad: 0, offset: off };
    }
    return { visible: state !== 'hidden', opacity, hingeRad: 0, offset: [0, 0, 0] };
  }

  // Visibility / fixed.
  return {
    visible: state !== 'hidden',
    opacity,
    hingeRad: 0,
    offset: [0, 0, 0],
  };
}

/* ---- quick-action presets (return the new parts map) ------------------ */

const setState = (
  parts: Record<string, PartRuntime>,
  id: string,
  state: CabinetPartState,
): Record<string, PartRuntime> => ({
  ...parts,
  [id]: { ...parts[id], state },
});

/** Open every hinged door. */
export function openAllDoors(
  model: CabinetModelDef,
  parts: Record<string, PartRuntime>,
): Record<string, PartRuntime> {
  let next = parts;
  for (const p of model.parts) {
    if (p.interaction === 'hinge') next = setState(next, p.id, 'open');
  }
  return next;
}

export function closeAllDoors(
  model: CabinetModelDef,
  parts: Record<string, PartRuntime>,
): Record<string, PartRuntime> {
  let next = parts;
  for (const p of model.parts) {
    if (p.interaction === 'hinge') next = setState(next, p.id, 'closed');
  }
  return next;
}

/** Hide every removable panel/cover (keeps them in place, just invisible). */
export function hideAllPanels(
  model: CabinetModelDef,
  parts: Record<string, PartRuntime>,
): Record<string, PartRuntime> {
  let next = parts;
  for (const p of model.parts) {
    if (p.states.includes('hidden')) next = setState(next, p.id, 'hidden');
  }
  return next;
}

/** Everything back to its authored default. */
export function restoreParts(model: CabinetModelDef): Record<string, PartRuntime> {
  const parts: Record<string, PartRuntime> = {};
  for (const p of model.parts) parts[p.id] = { state: p.defaultState };
  return parts;
}

/**
 * Preset that clears the interior for inspection: open front doors, take
 * off the panels that wall it in. Covers/back stay unless they obstruct.
 */
export function interiorParts(
  model: CabinetModelDef,
  parts: Record<string, PartRuntime>,
): Record<string, PartRuntime> {
  let next = parts;
  for (const p of model.parts) {
    if (!p.obstructsInterior) continue;
    if (p.interaction === 'hinge') next = setState(next, p.id, 'open');
    else if (p.states.includes('removed')) next = setState(next, p.id, 'removed');
    else if (p.states.includes('hidden')) next = setState(next, p.id, 'hidden');
  }
  return next;
}

/**
 * Maintenance preset: open doors, remove side panels, lift the top — the
 * rack prepared for service. Rails/interior stay so hardware is visible.
 */
export function maintenanceParts(
  model: CabinetModelDef,
  parts: Record<string, PartRuntime>,
): Record<string, PartRuntime> {
  let next = parts;
  for (const p of model.parts) {
    if (p.interaction === 'hinge') next = setState(next, p.id, 'open');
    else if (p.kind === 'side-panel' && p.states.includes('removed')) {
      next = setState(next, p.id, 'removed');
    } else if (p.kind === 'top-cover' && p.states.includes('removed')) {
      next = setState(next, p.id, 'removed');
    }
  }
  return next;
}
