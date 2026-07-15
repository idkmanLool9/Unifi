import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LibraryTab = 'browse' | 'favorites' | 'recent';

const MAX_RECENTS = 8;

interface LibraryState {
  activeTab: LibraryTab;
  /** Device whose preview panel is open. */
  selectedDeviceId: string | null;
  /** Expanded manufacturer groups in browse view. */
  expandedBrands: string[];
  favoriteIds: string[];
  /** Recently previewed devices, newest first. */
  recentIds: string[];

  setActiveTab: (tab: LibraryTab) => void;
  selectDevice: (id: string | null) => void;
  toggleBrand: (brandId: string) => void;
  toggleFavorite: (id: string) => void;
}

/**
 * UI state for the device library: navigation, preview selection,
 * favorites and recently-viewed. Favorites/recents persist; transient
 * navigation does not.
 */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      activeTab: 'browse',
      selectedDeviceId: null,
      expandedBrands: ['ubiquiti'],
      favoriteIds: [],
      recentIds: [],

      setActiveTab: (activeTab) => set({ activeTab }),

      selectDevice: (id) =>
        set((s) => ({
          selectedDeviceId: id,
          recentIds: id
            ? [id, ...s.recentIds.filter((r) => r !== id)].slice(0, MAX_RECENTS)
            : s.recentIds,
        })),

      toggleBrand: (brandId) =>
        set((s) => ({
          expandedBrands: s.expandedBrands.includes(brandId)
            ? s.expandedBrands.filter((b) => b !== brandId)
            : [...s.expandedBrands, brandId],
        })),

      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((f) => f !== id)
            : [...s.favoriteIds, id],
        })),
    }),
    {
      name: 'rackforge-library',
      partialize: (s) => ({
        favoriteIds: s.favoriteIds,
        recentIds: s.recentIds,
        expandedBrands: s.expandedBrands,
      }),
    },
  ),
);
