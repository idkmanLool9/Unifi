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
          railMode: 'auto',
          railSpacingMm: defaultRailSpacingMm(getProfile(DEFAULT_PROFILE_ID)),
          units,
          finish: 'steel',
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
      version: 4,
      partialize: (s) => ({ rack: s.rack }),
      // v1 racks predate rack profiles: adopt the default open frame at
      // the legacy 700mm rail spacing. v2 racks predate rail modes: keep
      // their spacing by staying manual. v3→v4: the default finish became
      // the Ubiquiti-matched silver, so racks still on the old dark
      // default adopt it (deliberately picked finishes are unaffected —
      // this only lifts the legacy default).
      migrate: (persisted) => {
        const state = persisted as { rack?: RackConfig | null };
        if (state?.rack && state.rack.profileId === undefined) {
          state.rack = {
            ...state.rack,
            profileId: DEFAULT_PROFILE_ID,
            railSpacingMm: 700,
          };
        }
        if (state?.rack && state.rack.railMode === undefined) {
          state.rack = { ...state.rack, railMode: 'manual' };
        }
        if (state?.rack && state.rack.finish === 'graphite') {
          state.rack = { ...state.rack, finish: 'steel' };
        }
        return state;
      },
    },
  ),
);
