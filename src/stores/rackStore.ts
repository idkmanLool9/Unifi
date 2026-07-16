import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RACK_STORE_KEY } from '@/lib/constants';
import {
  DEFAULT_PROFILE_ID,
  defaultRailSpacingMm,
  getProfile,
} from '@/features/rack/rackProfiles';
import type { RackConfig, RackSize } from '@/types';

interface RackState {
  /** The rack in the scene (single rack for now; multi-rack comes later). */
  rack: RackConfig | null;

  createRack: (units: RackSize) => void;
  updateRack: (patch: Partial<Omit<RackConfig, 'id' | 'createdAt'>>) => void;
  deleteRack: () => void;
}

export const useRackStore = create<RackState>()(
  persist(
    (set) => ({
      rack: null,

      createRack: (units) => {
        const rack: RackConfig = {
          id: crypto.randomUUID(),
          name: 'Untitled Rack',
          profileId: DEFAULT_PROFILE_ID,
          railSpacingMm: defaultRailSpacingMm(getProfile(DEFAULT_PROFILE_ID)),
          units,
          finish: 'graphite',
          orientation: 'front',
          showUnitNumbers: true,
          showRearPosts: true,
          showFloorMarker: true,
          createdAt: new Date().toISOString(),
        };
        set({ rack });
      },

      updateRack: (patch) =>
        set((s) => (s.rack ? { rack: { ...s.rack, ...patch } } : s)),

      deleteRack: () => set({ rack: null }),
    }),
    {
      name: RACK_STORE_KEY,
      version: 2,
      partialize: (s) => ({ rack: s.rack }),
      // v1 racks predate rack profiles: adopt the default open frame at
      // the legacy 700mm rail spacing.
      migrate: (persisted) => {
        const state = persisted as { rack?: RackConfig | null };
        if (state?.rack && state.rack.profileId === undefined) {
          state.rack = {
            ...state.rack,
            profileId: DEFAULT_PROFILE_ID,
            railSpacingMm: 700,
          };
        }
        return state;
      },
    },
  ),
);
