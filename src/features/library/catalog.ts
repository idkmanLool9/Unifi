/**
 * Library view-model over the central device registry. UI components render
 * these lightweight card shapes; the registry (features/devices) is the
 * single source of truth for definitions, and external metadata dropped
 * into /public/devices appears here automatically.
 */
import {
  allDevices,
  deviceThumbnailUrl,
  devicesByManufacturer,
  getDevice,
  manufacturerIds,
} from '@/features/devices/deviceRegistry';
import { isDeviceRemoved } from '@/stores/catalogEditsStore';
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
  /**
   * Real product render, present only for devices that ship a thumbnail
   * asset (those with a 3D model). Absent devices fall back to the
   * procedural faceplate illustration.
   */
  thumbnailUrl?: string;
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
  genexis: { monogram: 'Ge', tint: '#e5734b' },
  rackforge: { monogram: 'RF', tint: '#0a6cf5' },
};

/** Stable presentation order for known manufacturers. */
const BRAND_ORDER = ['ubiquiti', 'genexis', 'rackforge'];

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
    // Only expose a thumbnail URL when the device declares one, so devices
    // without a shipped asset never trigger a 404 on the convention path.
    thumbnailUrl:
      definition.thumbnailPath !== undefined
        ? deviceThumbnailUrl(definition)
        : undefined,
  };
}

function brandName(id: string): string {
  const definition = allDevices().find((d) => d.manufacturer === id);
  return definition?.manufacturerName ?? id;
}

/** Every manufacturer that has at least one device in the catalog. */
export function catalogBrands(): CatalogBrand[] {
  const ids = new Set<string>(
    manufacturerIds().filter((id) =>
      devicesByManufacturer(id).some((d) => !isDeviceRemoved(d.id)),
    ),
  );
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
  allDevices()
    .filter((d) => !isDeviceRemoved(d.id))
    .map(toCatalogView);

export const deviceById = (id: string): CatalogDevice | undefined => {
  const definition = getDevice(id);
  return definition ? toCatalogView(definition) : undefined;
};

export const brandById = (id: string): CatalogBrand | undefined =>
  catalogBrands().find((b) => b.id === id);

export const devicesByBrand = (brandId: string): CatalogDevice[] =>
  devicesByManufacturer(brandId)
    .filter((d) => !isDeviceRemoved(d.id))
    .map(toCatalogView);
