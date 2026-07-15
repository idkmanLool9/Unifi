import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const DELL_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'dell-r660',
    slug: 'poweredge-r660',
    manufacturer: 'dell',
    manufacturerName: 'Dell',
    productName: 'PowerEdge R660',
    modelNumber: 'R660',
    category: 'servers',
    rackUnits: 1,
    depthMm: 748,
    weightKg: 18.2,
    powerConsumptionWatts: 495,
    maximumPowerWatts: 1100,
    description:
      'Dual-socket 1U compute node tuned for dense virtualization and scale-out workloads.',
    tags: ['server', 'virtualization'],
    presentation: { faceplate: 'server', tone: 'metal' },
  }),
  defineDevice({
    id: 'dell-r760',
    slug: 'poweredge-r760',
    manufacturer: 'dell',
    manufacturerName: 'Dell',
    productName: 'PowerEdge R760',
    modelNumber: 'R760',
    category: 'servers',
    rackUnits: 2,
    depthMm: 772,
    weightKg: 28.3,
    powerConsumptionWatts: 610,
    maximumPowerWatts: 1400,
    description:
      'Flagship 2U platform with broad accelerator support and 24 NVMe-capable bays.',
    tags: ['server', 'gpu', 'popular'],
    presentation: { faceplate: 'server', tone: 'metal', badge: 'popular' },
  }),
];
