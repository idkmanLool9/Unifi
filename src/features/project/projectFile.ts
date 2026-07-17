import {
  clearModelBlobs,
  listModelBlobs,
  saveModelBlob,
} from '@/features/library/workspace/modelBlobStore';
import {
  AUTHORED_DEVICES_STORE_KEY,
  RACK_STORE_KEY,
  UI_STORE_KEY,
  VIEW_SETTINGS_STORE_KEY,
} from '@/lib/constants';

/**
 * Whole-project durability. One JSON file carries every persisted store
 * (rack, devices, cables, bundles, authored definitions, library
 * metadata, presets, routing rules, Etherlighting) plus the imported 3D
 * models from IndexedDB — everything the browser holds — so a project
 * survives a cleared cache and moves between devices as a plain file.
 *
 * The stores are exported as their raw persisted snapshots (the same
 * JSON zustand writes to localStorage), so import is exact-fidelity and
 * store version migrations run through the normal rehydration path
 * after a reload. New persisted stores are picked up automatically by
 * the `rackforge-` prefix — no per-store export code to keep in sync.
 */

export const PROJECT_FORMAT = 'rackforge-project@1';

const KEY_PREFIX = 'rackforge-';

/** Device-local preferences (theme, panels, camera) stay on the device. */
const LOCAL_ONLY_KEYS = new Set<string>([UI_STORE_KEY, VIEW_SETTINGS_STORE_KEY]);

export interface ProjectModelAsset {
  deviceId: string;
  /** Blob MIME type (GLB default). */
  type: string;
  base64: string;
}

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  exportedAt: string;
  /** Raw persisted store snapshots, keyed by their localStorage key. */
  stores: Record<string, unknown>;
  /** Imported 3D models (IndexedDB assets), base64-encoded. */
  models: ProjectModelAsset[];
}

export type ParseResult =
  | { ok: true; value: ProjectFile }
  | { ok: false; message: string };

/* ---- base64 (no FileReader — works in workers and tests) -------------- */

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/* ---- build / parse ----------------------------------------------------- */

/** Snapshots the whole project from localStorage + IndexedDB. */
export async function buildProjectFile(): Promise<ProjectFile> {
  const stores: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX) || LOCAL_ONLY_KEYS.has(key)) {
      continue;
    }
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      stores[key] = JSON.parse(raw) as unknown;
    } catch {
      stores[key] = raw;
    }
  }

  const models: ProjectModelAsset[] = [];
  for (const { deviceId, blob } of await listModelBlobs()) {
    models.push({
      deviceId,
      type: blob.type || 'model/gltf-binary',
      base64: await blobToBase64(blob),
    });
  }

  return {
    format: PROJECT_FORMAT,
    exportedAt: new Date().toISOString(),
    stores,
    models,
  };
}

/** Validates untrusted file text into a ProjectFile. */
export function parseProjectFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'Not a valid JSON file.' };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Not a RackForge project file.' };
  }
  const record = raw as Record<string, unknown>;
  if (record.format !== PROJECT_FORMAT) {
    return {
      ok: false,
      message:
        'Not a RackForge project file (expected format rackforge-project@1).',
    };
  }
  if (
    typeof record.stores !== 'object' ||
    record.stores === null ||
    Array.isArray(record.stores)
  ) {
    return { ok: false, message: 'Project file is missing its store data.' };
  }
  const models: ProjectModelAsset[] = [];
  if (record.models !== undefined) {
    if (!Array.isArray(record.models)) {
      return { ok: false, message: 'Project file has corrupt model data.' };
    }
    for (const entry of record.models) {
      const m = entry as Record<string, unknown>;
      if (
        typeof m !== 'object' ||
        m === null ||
        typeof m.deviceId !== 'string' ||
        typeof m.base64 !== 'string'
      ) {
        return { ok: false, message: 'Project file has corrupt model data.' };
      }
      models.push({
        deviceId: m.deviceId,
        type: typeof m.type === 'string' ? m.type : 'model/gltf-binary',
        base64: m.base64,
      });
    }
  }
  return {
    ok: true,
    value: {
      format: PROJECT_FORMAT,
      exportedAt:
        typeof record.exportedAt === 'string' ? record.exportedAt : '',
      stores: record.stores as Record<string, unknown>,
      models,
    },
  };
}

/* ---- apply ------------------------------------------------------------- */

/**
 * Replaces the persisted project with the file's contents. The caller
 * must reload afterwards — the app boots from persisted state exactly
 * like a fresh session, so every startup hook (authored definitions,
 * model rehydration, definition patches) applies in its normal order.
 */
export async function applyProjectFile(project: ProjectFile): Promise<void> {
  // Remove current work keys the file doesn't carry (full replacement),
  // leaving device-local preferences untouched.
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(KEY_PREFIX) &&
      !LOCAL_ONLY_KEYS.has(key) &&
      !(key in project.stores)
    ) {
      stale.push(key);
    }
  }
  for (const key of stale) localStorage.removeItem(key);

  for (const [key, value] of Object.entries(project.stores)) {
    if (!key.startsWith(KEY_PREFIX) || LOCAL_ONLY_KEYS.has(key)) continue;
    localStorage.setItem(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }

  await clearModelBlobs();
  for (const model of project.models) {
    await saveModelBlob(model.deviceId, base64ToBlob(model.base64, model.type));
  }
}

/* ---- summary ----------------------------------------------------------- */

export interface ProjectSummary {
  rackName: string | null;
  deviceCount: number;
  cableCount: number;
  authoredCount: number;
  modelCount: number;
}

/** What the import dialog shows before replacing the workspace. */
export function summarizeProject(project: ProjectFile): ProjectSummary {
  const state = (key: string): Record<string, unknown> | null => {
    const raw = project.stores[key];
    if (typeof raw !== 'object' || raw === null) return null;
    const s = (raw as Record<string, unknown>).state;
    return typeof s === 'object' && s !== null
      ? (s as Record<string, unknown>)
      : null;
  };
  const rack = state(RACK_STORE_KEY)?.rack;
  const rackName =
    typeof rack === 'object' &&
    rack !== null &&
    typeof (rack as Record<string, unknown>).name === 'string'
      ? ((rack as Record<string, unknown>).name as string)
      : null;
  const instances = state('rackforge-devices')?.instances;
  const cables = state('rackforge-cables')?.cables;
  const definitions = state(AUTHORED_DEVICES_STORE_KEY)?.definitions;
  return {
    rackName,
    deviceCount: Array.isArray(instances) ? instances.length : 0,
    cableCount: Array.isArray(cables) ? cables.length : 0,
    authoredCount:
      typeof definitions === 'object' && definitions !== null
        ? Object.keys(definitions).length
        : 0,
    modelCount: project.models.length,
  };
}

/** Suggested download name, derived from the rack/project name. */
export function projectFileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'rackforge-project'}.rackforge-project.json`;
}
