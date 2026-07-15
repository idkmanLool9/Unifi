import { create } from 'zustand';
import { BUILTIN_DEFINITIONS } from './definitions';
import {
  validateDeviceDefinition,
  type DeviceCategory,
  type DeviceDefinition,
} from './deviceSchema';

/**
 * Central device registry. Built-in definitions register synchronously at
 * import; external definitions load from /devices/manifest.json at startup
 * and override built-ins by id (dropped-in metadata is authoritative).
 * Designed to scale: lookups are Map-based, groupings are computed lazily
 * and cached per registry version.
 */

const registry = new Map<string, DeviceDefinition>();
for (const definition of BUILTIN_DEFINITIONS) {
  registry.set(definition.id, definition);
}

interface RegistryState {
  /** Bumped whenever the registry contents change, for UI subscriptions. */
  version: number;
  externalLoaded: boolean;
  bump: () => void;
  markLoaded: () => void;
}

export const useRegistryStore = create<RegistryState>()((set) => ({
  version: 1,
  externalLoaded: false,
  bump: () => set((s) => ({ version: s.version + 1 })),
  markLoaded: () => set({ externalLoaded: true }),
}));

/* ---- Lookups ------------------------------------------------------ */

export const getDevice = (id: string): DeviceDefinition | undefined =>
  registry.get(id);

export const allDevices = (): DeviceDefinition[] => [...registry.values()];

export const devicesByManufacturer = (
  manufacturer: string,
): DeviceDefinition[] =>
  allDevices().filter((d) => d.manufacturer === manufacturer);

export const devicesByCategory = (
  category: DeviceCategory,
): DeviceDefinition[] => allDevices().filter((d) => d.category === category);

export const manufacturerIds = (): string[] => [
  ...new Set(allDevices().map((d) => d.manufacturer)),
];

/** Searches product name, model number, manufacturer, tags and category. */
export function searchDevices(query: string): DeviceDefinition[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return allDevices();
  return allDevices().filter((d) => {
    const haystack = [
      d.productName,
      d.modelNumber,
      d.manufacturerName,
      d.category,
      ...d.tags,
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/* ---- Asset paths --------------------------------------------------- */

/** Conventional asset folder for a device. */
export const deviceAssetDir = (d: DeviceDefinition): string =>
  `/devices/${d.manufacturer}/${d.slug}`;

/** URL of the device's GLB model (explicit path wins over convention). */
export const deviceModelUrl = (d: DeviceDefinition): string =>
  d.frontModelPath ?? `${deviceAssetDir(d)}/model.glb`;

/** URL of the device's thumbnail (explicit path wins over convention). */
export const deviceThumbnailUrl = (d: DeviceDefinition): string =>
  d.thumbnailPath ?? `${deviceAssetDir(d)}/thumbnail.webp`;

/* ---- Registration & external loading ------------------------------- */

/** Registers (or overrides) a validated definition. */
export function registerDevice(definition: DeviceDefinition): void {
  registry.set(definition.id, definition);
  useRegistryStore.getState().bump();
}

interface DeviceManifest {
  devices: string[];
}

function parseManifest(input: unknown): DeviceManifest | null {
  if (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as Record<string, unknown>).devices) &&
    ((input as Record<string, unknown>).devices as unknown[]).every(
      (d): d is string => typeof d === 'string',
    )
  ) {
    return input as unknown as DeviceManifest;
  }
  return null;
}

/**
 * Loads external device definitions listed in /devices/manifest.json.
 * Each entry is a `<manufacturer>/<slug>` folder containing metadata.json.
 * Invalid or missing entries are logged and skipped — the app never fails
 * on a bad asset drop. Safe to call once at startup.
 */
export async function loadExternalDefinitions(): Promise<void> {
  const store = useRegistryStore.getState();
  try {
    const response = await fetch('/devices/manifest.json');
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('json')) return;

    const manifest = parseManifest(await response.json());
    if (!manifest) {
      console.warn('[devices] manifest.json is malformed; skipping');
      return;
    }

    await Promise.all(
      manifest.devices.map(async (folder) => {
        try {
          const res = await fetch(`/devices/${folder}/metadata.json`);
          const type = res.headers.get('content-type') ?? '';
          if (!res.ok || !type.includes('json')) return;
          const result = validateDeviceDefinition(await res.json());
          if (result.ok) {
            registry.set(result.value.id, result.value);
          } else {
            console.warn(
              `[devices] ${folder}/metadata.json failed validation:`,
              result.issues
                .map((i) => `${i.path}: ${i.message}`)
                .join('; '),
            );
          }
        } catch (error) {
          console.warn(`[devices] failed to load ${folder}:`, error);
        }
      }),
    );
    store.bump();
  } catch {
    // No manifest deployed — built-ins only. Not an error.
  } finally {
    store.markLoaded();
  }
}
