import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const SYNOLOGY_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'syn-rs1221',
    slug: 'rackstation-rs1221-plus',
    manufacturer: 'synology',
    manufacturerName: 'Synology',
    productName: 'RackStation RS1221+',
    modelNumber: 'RS1221+',
    category: 'storage',
    rackUnits: 2,
    depthMm: 306,
    weightKg: 8.0,
    powerConsumptionWatts: 72,
    maximumPowerWatts: 150,
    description:
      'Short-depth 8-bay NAS for SMB backup, file serving and surveillance archives.',
    tags: ['nas', 'short-depth'],
    ports: [{ id: 'lan', type: 'rj45', count: 4, label: 'LAN 1–4' }],
    presentation: {
      faceplate: 'storage',
      tone: 'dark',
      portsLabel: '4 ports',
      speedLabel: '1G',
    },
  }),
  defineDevice({
    id: 'syn-rs822',
    slug: 'rackstation-rs822-plus',
    manufacturer: 'synology',
    manufacturerName: 'Synology',
    productName: 'RackStation RS822+',
    modelNumber: 'RS822+',
    category: 'storage',
    rackUnits: 1,
    depthMm: 307,
    weightKg: 6.5,
    powerConsumptionWatts: 45,
    maximumPowerWatts: 110,
    description:
      'Compact 4-bay NAS with optional 10G upgrade and hot-swappable drive trays.',
    tags: ['nas', 'short-depth'],
    ports: [{ id: 'lan', type: 'rj45', count: 4, label: 'LAN 1–4' }],
    presentation: {
      faceplate: 'storage',
      tone: 'dark',
      portsLabel: '4 ports',
      speedLabel: '1G',
    },
  }),
];
