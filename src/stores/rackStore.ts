import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RACK_STORE_KEY } from '@/lib/constants';
import type { RackConfig, RackSize } from '@/types';

interface RackState {
  /** The rack in the scene (single rack for now; multi-rack comes later). */
  rack: RackConfig | null;
  /** Transient selection — intentionally not persisted. */
  selectedId: string | null;

  createRack: (units: RackSize) => void;
  updateRack: (patch: Partial<Omit<RackConfig, 'id' | 'createdAt'>>) => void;
  deleteRack: () => void;
  setSelected: (id: string | null) => void;
}

export const useRackStore = create<RackState>()(
  persist(
    (set) => ({
      rack: null,
      selectedId: null,

      createRack: (units) => {
        const rack: RackConfig = {
          id: crypto.randomUUID(),
          name: 'Untitled Rack',
          units,
          finish: 'graphite',
          orientation: 'front',
          showUnitNumbers: true,
          showRearPosts: true,
          showFloorMarker: true,
          createdAt: new Date().toISOString(),
        };
        // Select on creation so the inspector opens on the rack.
        set({ rack, selectedId: rack.id });
      },

      updateRack: (patch) =>
        set((s) => (s.rack ? { rack: { ...s.rack, ...patch } } : s)),

      deleteRack: () => set({ rack: null, selectedId: null }),

      setSelected: (selectedId) => set({ selectedId }),
    }),
    {
      name: RACK_STORE_KEY,
      partialize: (s) => ({ rack: s.rack }),
    },
  ),
);
