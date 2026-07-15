import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const SUPERMICRO_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'smc-sys-121c',
    slug: 'superserver-121c',
    manufacturer: 'supermicro',
    manufacturerName: 'Supermicro',
    productName: 'SuperServer 121C',
    modelNumber: 'SYS-121C-TN10R',
    category: 'servers',
    rackUnits: 1,
    depthMm: 737,
    weightKg: 16.8,
    powerConsumptionWatts: 420,
    maximumPowerWatts: 860,
    description:
      'Cloud-optimized 1U system with twelve DDR5 slots and tool-less NVMe bays.',
    tags: ['server', 'nvme'],
    presentation: { faceplate: 'server', tone: 'metal' },
  }),
];
