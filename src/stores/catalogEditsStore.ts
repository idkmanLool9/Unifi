import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User-owned edits to the device catalog: per-device list-price overrides
 * and devices removed from the library. Kept separate from the shipped
 * definitions and prices (which stay the source of truth) so every edit is
 * reversible — clear a price to fall back to the built-in estimate, restore
 * a device to bring it back. Persists in the browser and survives reloads.
 */
interface CatalogEditsState {
  /** Per-device list-price overrides, USD. Absent → use the built-in price. */
  priceUsd: Record<string, number>;
  /** Devices hidden from the whole catalog; restorable, never destroyed. */
  removedIds: string[];

  setPrice: (id: string, usd: number) => void;
  clearPrice: (id: string) => void;
  removeDevice: (id: string) => void;
  restoreDevice: (id: string) => void;
}

export const useCatalogEditsStore = create<CatalogEditsState>()(
  persist(
    (set) => ({
      priceUsd: {},
      removedIds: [],

      setPrice: (id, usd) =>
        set((s) => ({ priceUsd: { ...s.priceUsd, [id]: usd } })),
      clearPrice: (id) =>
        set((s) => {
          const next = { ...s.priceUsd };
          delete next[id];
          return { priceUsd: next };
        }),
      removeDevice: (id) =>
        set((s) => ({
          removedIds: s.removedIds.includes(id)
            ? s.removedIds
            : [...s.removedIds, id],
        })),
      restoreDevice: (id) =>
        set((s) => ({ removedIds: s.removedIds.filter((x) => x !== id) })),
    }),
    { name: 'rackforge-catalog-edits', version: 1 },
  ),
);

/**
 * Module mirror of the edits, so pure/non-React code (price lookups, the
 * catalog list builders) can read the current state synchronously without
 * subscribing. Kept in sync on every store change; components that need to
 * re-render still subscribe to the store directly.
 */
let priceMirror: Record<string, number> = useCatalogEditsStore.getState().priceUsd;
let removedMirror = new Set(useCatalogEditsStore.getState().removedIds);
useCatalogEditsStore.subscribe((s) => {
  priceMirror = s.priceUsd;
  removedMirror = new Set(s.removedIds);
});

/** Current USD price override for a device, or undefined when none is set. */
export const getPriceOverride = (id: string): number | undefined =>
  priceMirror[id];

/** True when the user has removed this device from the library. */
export const isDeviceRemoved = (id: string): boolean => removedMirror.has(id);
