import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { builtinDevice, registerDevice } from '@/features/devices/deviceRegistry';
import {
  validateDeviceDefinition,
  type DeviceDefinition,
} from '@/features/devices/deviceSchema';
import { AUTHORED_DEVICES_STORE_KEY } from '@/lib/constants';

/**
 * Durable storage for hand-authored device definitions. "Save Ports" in
 * the Device Authoring mode writes the full definition JSON here; at
 * every app start the stored definitions re-register on top of
 * built-ins and external metadata, so an authored device stays authored
 * — in this browser — without any file handling. (The dev server
 * additionally writes the metadata into public/devices so it ships for
 * everyone.)
 */

interface AuthoredDevicesState {
  /** Raw definition JSON keyed by device id (validated on apply). */
  definitions: Record<string, unknown>;
  saveDefinition: (id: string, definition: unknown) => void;
  removeDefinition: (id: string) => void;
}

export const useAuthoredDevicesStore = create<AuthoredDevicesState>()(
  persist(
    (set) => ({
      definitions: {},
      saveDefinition: (id, definition) =>
        set((s) => ({ definitions: { ...s.definitions, [id]: definition } })),
      removeDefinition: (id) =>
        set((s) => {
          const next = { ...s.definitions };
          delete next[id];
          return { definitions: next };
        }),
    }),
    { name: AUTHORED_DEVICES_STORE_KEY },
  ),
);

/**
 * An authored copy of a built-in is frozen at save time. When the
 * built-in later grows rear pass-through openings (a feed-through patch
 * panel now has an RJ45 jack on both faces), an older authored copy
 * would otherwise hide those rear ports forever. Re-graft any rear-facing
 * port group the built-in ships that the authored copy is missing — this
 * is purely additive (matched by group id), so hand-authored front-face
 * layout is never touched, and rear cabling simply starts working.
 */
function withInheritedRearPorts(def: DeviceDefinition): DeviceDefinition {
  const builtin = builtinDevice(def.id);
  if (!builtin) return def;
  const present = new Set(def.ports.map((p) => p.id));
  const missingRear = builtin.ports.filter(
    (p) => (p.location ?? 'front') === 'rear' && !present.has(p.id),
  );
  if (missingRear.length === 0) return def;
  return { ...def, ports: [...def.ports, ...missingRear] };
}

/**
 * Validates and registers a set of stored definition records. Invalid
 * records are skipped (never crash startup over bad persisted data).
 * Returns the number of definitions applied.
 */
export function applyAuthoredDefinitions(
  records: Record<string, unknown>,
): number {
  let applied = 0;
  for (const [id, raw] of Object.entries(records)) {
    const result = validateDeviceDefinition(raw);
    if (!result.ok || result.value.id !== id) {
      console.warn(`[devices] skipping invalid authored definition: ${id}`);
      continue;
    }
    registerDevice(withInheritedRearPorts(result.value));
    applied++;
  }
  return applied;
}

/** Applies everything persisted in this browser (startup hook). */
export const applyPersistedAuthoredDevices = (): number =>
  applyAuthoredDefinitions(useAuthoredDevicesStore.getState().definitions);
