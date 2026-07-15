import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const HPE_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'hpe-dl380-g11',
    slug: 'proliant-dl380-gen11',
    manufacturer: 'hpe',
    manufacturerName: 'HPE',
    productName: 'ProLiant DL380 Gen11',
    modelNumber: 'DL380 Gen11',
    category: 'servers',
    rackUnits: 2,
    depthMm: 713,
    weightKg: 27.1,
    powerConsumptionWatts: 550,
    maximumPowerWatts: 1600,
    description:
      'The industry-standard 2U workhorse with iLO 6 and flexible storage cages.',
    tags: ['server', 'popular'],
    presentation: { faceplate: 'server', tone: 'metal' },
  }),
  defineDevice({
    id: 'hpe-dl20-g11',
    slug: 'proliant-dl20-gen11',
    manufacturer: 'hpe',
    manufacturerName: 'HPE',
    productName: 'ProLiant DL20 Gen11',
    modelNumber: 'DL20 Gen11',
    category: 'servers',
    rackUnits: 1,
    depthMm: 438,
    weightKg: 8.4,
    powerConsumptionWatts: 290,
    maximumPowerWatts: 500,
    description:
      'Short-depth single-socket server for edge and branch deployments.',
    tags: ['server', 'edge', 'short-depth'],
    presentation: { faceplate: 'server', tone: 'metal' },
  }),
];
