/**
 * Library view-model over the central device registry. UI components render
 * these lightweight card shapes; the registry (features/devices) is the
 * single source of truth for definitions, and external metadata dropped
 * into /public/devices appears here automatically.
 */
import {
  allDevices,
  devicesByManufacturer,
  getDevice,
  manufacturerIds,
} from '@/features/devices/deviceRegistry';
import type {
  DeviceCategory,
  DeviceDefinition,
  FaceplateStyle,
} from '@/features/devices/deviceSchema';

export type { DeviceCategory, FaceplateStyle };

export interface CatalogDevice {
  id: string;
  name: string;
  brandId: string;
  category: DeviceCategory;
  units: number;
  ports?: string;
  speed?: string;
  poe?: boolean;
  weightKg: number;
  depthMm: number;
  powerW: number;
  description: string;
  badge?: 'popular' | 'new';
  faceplate: FaceplateStyle;
  tone: 'dark' | 'metal';
}

export interface CatalogBrand {
  id: string;
  name: string;
  /** Two-letter monogram for the brand tile. */
  monogram: string;
  /** Brand tint for the monogram tile (used at low opacity). */
  tint: string;
}

/** Visual identities for known manufacturers; unknown ones get a fallback. */
const BRAND_VISUALS: Record<string, { monogram: string; tint: string }> = {
  ubiquiti: { monogram: 'Ub', tint: '#2f6bef' },
  dell: { monogram: 'De', tint: '#0f7bc4' },
  synology: { monogram: 'Sy', tint: '#8a8f99' },
  apc: { monogram: 'AP', tint: '#c2483d' },
  cisco: { monogram: 'Ci', tint: '#12a3b4' },
  mikrotik: { monogram: 'Mi', tint: '#5a8dd6' },
  supermicro: { monogram: 'Su', tint: '#3f9e5f' },
  hpe: { monogram: 'HP', tint: '#25b28a' },
  tplink: { monogram: 'TP', tint: '#3aa0d8' },
};

/** Stable presentation order for known manufacturers. */
const BRAND_ORDER = [
  'ubiquiti',
  'dell',
  'synology',
  'apc',
  'cisco',
  'mikrotik',
  'supermicro',
  'hpe',
  'tplink',
];

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  routing: 'Routing',
  switching: 'Switching',
  servers: 'Servers',
  storage: 'Storage',
  power: 'Power',
  accessories: 'Accessories',
};

function toCatalogView(definition: DeviceDefinition): CatalogDevice {
  return {
    id: definition.id,
    name: definition.productName,
    brandId: definition.manufacturer,
    category: definition.category,
    units: definition.rackUnits,
    ports: definition.presentation.portsLabel,
    speed: definition.presentation.speedLabel,
    poe: definition.presentation.poe,
    weightKg: definition.weightKg,
    depthMm: definition.depthMm,
    powerW: definition.powerConsumptionWatts,
    description: definition.description,
    badge: definition.presentation.badge,
    faceplate: definition.presentation.faceplate,
    tone: definition.presentation.tone,
  };
}

function brandName(id: string): string {
  const definition = allDevices().find((d) => d.manufacturer === id);
  return definition?.manufacturerName ?? id;
}

/** All brands with devices, plus known empty brands (kept for browsing). */
export function catalogBrands(): CatalogBrand[] {
  const ids = new Set<string>([...manufacturerIds(), 'tplink']);
  return [...ids]
    .sort((a, b) => {
      const ai = BRAND_ORDER.indexOf(a);
      const bi = BRAND_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((id) => {
      const visual = BRAND_VISUALS[id] ?? {
        monogram: brandName(id).slice(0, 2),
        tint: '#8a8f99',
      };
      return { id, name: brandName(id) || id, ...visual };
    });
}

export const catalogDevices = (): CatalogDevice[] =>
  allDevices().map(toCatalogView);

export const deviceById = (id: string): CatalogDevice | undefined => {
  const definition = getDevice(id);
  return definition ? toCatalogView(definition) : undefined;
};

export const brandById = (id: string): CatalogBrand | undefined =>
  catalogBrands().find((b) => b.id === id);

export const devicesByBrand = (brandId: string): CatalogDevice[] =>
  devicesByManufacturer(brandId).map(toCatalogView);
