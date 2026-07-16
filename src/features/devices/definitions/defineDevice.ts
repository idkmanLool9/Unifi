import type {
  AccessoryKind,
  CoolingCapabilities,
  DeviceDefinition,
  DevicePresentation,
  DisplayCapabilities,
  LedDefinition,
  LightingCapabilities,
  MechanicalSpec,
  ModelTransform,
  PortDefinition,
  PowerCapabilities,
} from '../deviceSchema';
import type { RackOrientation } from '@/types';

/** Required fields for a built-in definition; the rest take defaults. */
export interface DeviceSeed {
  id: string;
  slug: string;
  manufacturer: string;
  manufacturerName: string;
  productName: string;
  modelNumber: string;
  category: DeviceDefinition['category'];
  rackUnits: number;
  depthMm: number;
  weightKg: number;
  powerConsumptionWatts: number;
  maximumPowerWatts: number;
  description: string;
  presentation: DevicePresentation;
  widthMm?: number;
  heightMm?: number;
  mountingStandard?: DeviceDefinition['mountingStandard'];
  defaultFacing?: RackOrientation;
  tags?: string[];
  modelTransform?: Partial<ModelTransform>;
  modelDetail?: DeviceDefinition['modelDetail'];
  mountingOffsetMm?: number;
  ports?: PortDefinition[];
  leds?: LedDefinition[];
  lighting?: LightingCapabilities;
  power?: PowerCapabilities;
  cooling?: CoolingCapabilities;
  display?: DisplayCapabilities;
  mechanical?: MechanicalSpec;
  accessoryKind?: AccessoryKind;
}

/** Standard 19in faceplate body width (fits the 450.8mm EIA opening). */
const DEFAULT_BODY_WIDTH_MM = 442;
/** Panel height per U, leaving a small alignment clearance. */
const PANEL_HEIGHT_PER_U_MM = 43.7;

export function defineDevice(seed: DeviceSeed): DeviceDefinition {
  return {
    ...seed,
    widthMm: seed.widthMm ?? DEFAULT_BODY_WIDTH_MM,
    heightMm: seed.heightMm ?? seed.rackUnits * PANEL_HEIGHT_PER_U_MM,
    mountingStandard: seed.mountingStandard ?? 'eia-310',
    defaultFacing: seed.defaultFacing ?? 'front',
    tags: seed.tags ?? [],
    // Absent means "derive automatically from the measured geometry" —
    // the universal importer owns the default; explicit metadata wins.
    modelTransform:
      seed.modelTransform === undefined
        ? undefined
        : {
            scale: seed.modelTransform.scale ?? 1,
            rotationDeg: seed.modelTransform.rotationDeg ?? [0, 0, 0],
            offsetMm: seed.modelTransform.offsetMm ?? [0, 0, 0],
          },
    mountingOffsetMm: seed.mountingOffsetMm ?? 0,
    ports: seed.ports ?? [],
    leds: seed.leds ?? [],
  };
}
