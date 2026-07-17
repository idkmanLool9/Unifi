import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CableTypeId } from '@/features/cables/cableCatalog';

/**
 * Reusable cable definitions — the user's cable library. A preset
 * captures everything about a cable except its endpoints, so "the blue
 * 2m Cat6A patch we buy by the box" is defined once and applied to any
 * connection.
 */

export interface CablePreset {
  id: string;
  name: string;
  type: CableTypeId;
  color: string;
  lengthMm: number;
  manufacturer?: string;
  partNumber?: string;
  notes?: string;
}

interface CablePresetsState {
  presets: CablePreset[];
  addPreset: (preset: Omit<CablePreset, 'id'>) => CablePreset;
  updatePreset: (id: string, patch: Partial<Omit<CablePreset, 'id'>>) => void;
  removePreset: (id: string) => void;
}

export const useCablePresetsStore = create<CablePresetsState>()(
  persist(
    (set) => ({
      presets: [],

      addPreset: (input) => {
        const preset: CablePreset = { id: crypto.randomUUID(), ...input };
        set((s) => ({ presets: [...s.presets, preset] }));
        return preset;
      },

      updatePreset: (id, patch) =>
        set((s) => ({
          presets: s.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    { name: 'rackforge-cable-presets' },
  ),
);
