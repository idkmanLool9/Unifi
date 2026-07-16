import { U_METERS } from '@/features/rack/rackConstants';
import {
  validatePlacement,
  type PlacementContext,
  type PlacementResult,
} from '@/features/rack/rackMath';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * Rack-unit snapping for drag placement. Pure math — no three.js, no
 * store access — so the exact behavior is unit-testable.
 */

/** Hysteresis margin (in U) before the preview leaves its current slot. */
export const SNAP_HYSTERESIS_U = 0.2;

/** How far (in U) the snapper searches for the nearest valid slot. */
export const VALID_SLOT_SEARCH_RADIUS = 2;

/** Highest legal startU for a device of `units` height. */
export const maxStartU = (units: number, rackUnits: number): number =>
  Math.max(1, rackUnits - units + 1);

const clampStartU = (startU: number, units: number, rackUnits: number): number =>
  Math.min(maxStartU(units, rackUnits), Math.max(1, startU));

/**
 * The startU whose device span is centered nearest the pointer. `yLocal`
 * is in rack-local meters; U1 begins at the rail base.
 */
export function pointerStartU(
  yLocal: number,
  units: number,
  rackUnits: number,
  railBaseYM: number,
): number {
  // Continuous unit coordinate: a pointer inside U1 maps to [1, 2).
  const uFloat = (yLocal - railBaseYM) / U_METERS + 1;
  return clampStartU(Math.round(uFloat - units / 2), units, rackUnits);
}

/**
 * Stable snapping: keeps the previous slot until the pointer has moved
 * past the slot boundary plus a hysteresis margin, so jitter on a U
 * boundary never flickers the preview between neighbours.
 */
export function snapStartU(
  yLocal: number,
  previousStartU: number | null,
  units: number,
  rackUnits: number,
  railBaseYM: number,
  hysteresisU: number = SNAP_HYSTERESIS_U,
): number {
  const candidate = pointerStartU(yLocal, units, rackUnits, railBaseYM);
  if (previousStartU === null || candidate === previousStartU) return candidate;

  const uFloat = (yLocal - railBaseYM) / U_METERS + 1;
  // Center of the currently held span, in continuous unit coordinates.
  const heldCenter = previousStartU + units / 2;
  return Math.abs(uFloat - heldCenter) > 0.5 + hysteresisU
    ? candidate
    : previousStartU;
}

export interface SlotChoice {
  startU: number;
  validation: PlacementResult;
}

/**
 * Prefers the nearest valid slot within a small search radius of the
 * pointer's slot (professional assist). When nothing nearby is valid —
 * or when `precise` is set (Shift) — the pointer's own slot is returned
 * with its honest validation result; invalid placements are shown, never
 * silently corrected.
 */
export function chooseSlot(
  candidateStartU: number,
  definition: DeviceDefinition,
  ctx: PlacementContext,
  options: { precise?: boolean; ignoreInstanceId?: string } = {},
): SlotChoice {
  const validate = (startU: number): PlacementResult =>
    validatePlacement(definition, startU, ctx, options.ignoreInstanceId);

  const atPointer = validate(candidateStartU);
  if (atPointer.ok || options.precise) {
    return { startU: candidateStartU, validation: atPointer };
  }

  const limit = maxStartU(definition.rackUnits, ctx.rackUnits);
  for (let offset = 1; offset <= VALID_SLOT_SEARCH_RADIUS; offset++) {
    for (const startU of [candidateStartU - offset, candidateStartU + offset]) {
      if (startU < 1 || startU > limit) continue;
      const result = validate(startU);
      if (result.ok) return { startU, validation: result };
    }
  }
  return { startU: candidateStartU, validation: atPointer };
}
