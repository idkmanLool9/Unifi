import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persistent library metadata that lives BESIDE device definitions:
 * user tags, notes, versioning, visibility, custom category
 * assignments, custom categories and collections. Definitions stay the
 * single source of truth for hardware facts; this store owns the
 * asset-management layer on top — everything here saves instantly and
 * survives reloads.
 */

export interface ChangelogEntry {
  /** ISO timestamp. */
  at: string;
  note: string;
}

export interface DeviceMeta {
  /** Extra user tags (merged with definition tags for search). */
  tags?: string[];
  notes?: string;
  /** Semantic version string, user-managed. */
  version?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  changelog?: ChangelogEntry[];
  /** Hidden devices stay in the library but out of the editor palette. */
  hidden?: boolean;
  /** Assignment to a user-created category node. */
  customCategoryId?: string;
}

export interface CustomCategory {
  id: string;
  name: string;
}

export interface DeviceCollection {
  id: string;
  name: string;
  deviceIds: string[];
}

interface LibraryMetaState {
  deviceMeta: Record<string, DeviceMeta>;
  customCategories: CustomCategory[];
  collections: DeviceCollection[];
  /** Pinned device ids (quick access, shown first in Recent). */
  pinnedIds: string[];
  /**
   * Persisted edits to definition fields (name, description, tags,
   * category…) keyed by device id — re-applied over the registered
   * definition at startup so edits to built-ins survive reloads.
   */
  definitionPatches: Record<string, Record<string, unknown>>;

  patchMeta: (deviceId: string, patch: Partial<DeviceMeta>) => void;
  addChangelog: (deviceId: string, note: string) => void;
  setDefinitionPatch: (deviceId: string, patch: Record<string, unknown>) => void;

  addCategory: (name: string) => CustomCategory;
  renameCategory: (id: string, name: string) => void;
  removeCategory: (id: string) => void;

  addCollection: (name?: string) => DeviceCollection;
  renameCollection: (id: string, name: string) => void;
  removeCollection: (id: string) => void;
  addToCollection: (collectionId: string, deviceId: string) => void;
  removeFromCollection: (collectionId: string, deviceId: string) => void;

  togglePinned: (deviceId: string) => void;
}

const now = () => new Date().toISOString();

export const useLibraryMetaStore = create<LibraryMetaState>()(
  persist(
    (set) => ({
      deviceMeta: {},
      customCategories: [],
      collections: [],
      pinnedIds: [],
      definitionPatches: {},

      patchMeta: (deviceId, patch) =>
        set((s) => {
          const previous = s.deviceMeta[deviceId] ?? {};
          return {
            deviceMeta: {
              ...s.deviceMeta,
              [deviceId]: {
                ...previous,
                ...patch,
                createdAt: previous.createdAt ?? now(),
                updatedAt: now(),
              },
            },
          };
        }),

      addChangelog: (deviceId, note) =>
        set((s) => {
          const previous = s.deviceMeta[deviceId] ?? {};
          return {
            deviceMeta: {
              ...s.deviceMeta,
              [deviceId]: {
                ...previous,
                createdAt: previous.createdAt ?? now(),
                updatedAt: now(),
                changelog: [...(previous.changelog ?? []), { at: now(), note }],
              },
            },
          };
        }),

      setDefinitionPatch: (deviceId, patch) =>
        set((s) => ({
          definitionPatches: {
            ...s.definitionPatches,
            [deviceId]: { ...s.definitionPatches[deviceId], ...patch },
          },
        })),

      addCategory: (name) => {
        const category: CustomCategory = {
          id: `custom-${crypto.randomUUID().slice(0, 8)}`,
          name,
        };
        set((s) => ({ customCategories: [...s.customCategories, category] }));
        return category;
      },
      renameCategory: (id, name) =>
        set((s) => ({
          customCategories: s.customCategories.map((c) =>
            c.id === id ? { ...c, name } : c,
          ),
        })),
      removeCategory: (id) =>
        set((s) => ({
          customCategories: s.customCategories.filter((c) => c.id !== id),
          deviceMeta: Object.fromEntries(
            Object.entries(s.deviceMeta).map(([deviceId, meta]) => [
              deviceId,
              meta.customCategoryId === id
                ? { ...meta, customCategoryId: undefined }
                : meta,
            ]),
          ),
        })),

      addCollection: (name) => {
        const collection: DeviceCollection = {
          id: crypto.randomUUID(),
          name: name ?? 'New collection',
          deviceIds: [],
        };
        set((s) => ({ collections: [...s.collections, collection] }));
        return collection;
      },
      renameCollection: (id, name) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id ? { ...c, name } : c,
          ),
        })),
      removeCollection: (id) =>
        set((s) => ({
          collections: s.collections.filter((c) => c.id !== id),
        })),
      addToCollection: (collectionId, deviceId) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId && !c.deviceIds.includes(deviceId)
              ? { ...c, deviceIds: [...c.deviceIds, deviceId] }
              : c,
          ),
        })),
      removeFromCollection: (collectionId, deviceId) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, deviceIds: c.deviceIds.filter((d) => d !== deviceId) }
              : c,
          ),
        })),

      togglePinned: (deviceId) =>
        set((s) => ({
          pinnedIds: s.pinnedIds.includes(deviceId)
            ? s.pinnedIds.filter((p) => p !== deviceId)
            : [...s.pinnedIds, deviceId],
        })),
    }),
    { name: 'rackforge-library-meta' },
  ),
);
