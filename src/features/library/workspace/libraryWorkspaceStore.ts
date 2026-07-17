import { create } from 'zustand';
import { EMPTY_FILTERS, type LibraryFilters, type LibrarySort } from './libraryIndex';

/**
 * Transient navigation state for the Device Library workspace: the
 * active sidebar scope, live search text, filter set, sort order and
 * the previewed device. Nothing here persists — favorites, recents,
 * collections and metadata live in their own stores.
 */

export type LibraryScope =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'category'; nodeId: string }
  | { kind: 'manufacturer'; id: string }
  | { kind: 'collection'; id: string };

interface LibraryWorkspaceState {
  scope: LibraryScope;
  query: string;
  filters: LibraryFilters;
  sort: LibrarySort;
  selectedId: string | null;

  setScope: (scope: LibraryScope) => void;
  setQuery: (query: string) => void;
  patchFilters: (patch: Partial<LibraryFilters>) => void;
  clearFilters: () => void;
  setSort: (sort: LibrarySort) => void;
  select: (id: string | null) => void;
}

export const useLibraryWorkspaceStore = create<LibraryWorkspaceState>()((set) => ({
  scope: { kind: 'all' },
  query: '',
  filters: EMPTY_FILTERS,
  sort: 'manufacturer',
  selectedId: null,

  setScope: (scope) => set({ scope }),
  setQuery: (query) => set({ query }),
  patchFilters: (patch) =>
    set((s) => ({ filters: { ...s.filters, ...patch } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSort: (sort) => set({ sort }),
  select: (selectedId) => set({ selectedId }),
}));
