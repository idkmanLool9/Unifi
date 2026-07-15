import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const APC_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'apc-smt1500rm',
    slug: 'smart-ups-1500',
    manufacturer: 'apc',
    manufacturerName: 'APC',
    productName: 'Smart-UPS 1500',
    modelNumber: 'SMT1500RM2U',
    category: 'power',
    rackUnits: 2,
    depthMm: 457,
    weightKg: 27.6,
    powerConsumptionWatts: 25,
    maximumPowerWatts: 1000,
    description:
      'Line-interactive 1500VA UPS with pure sine output and network management slot.',
    tags: ['ups', 'popular'],
    presentation: { faceplate: 'ups', tone: 'dark', badge: 'popular' },
  }),
  defineDevice({
    id: 'apc-ap8861',
    slug: 'rack-pdu-9000',
    manufacturer: 'apc',
    manufacturerName: 'APC',
    productName: 'Rack PDU 9000',
    modelNumber: 'AP8861',
    category: 'power',
    rackUnits: 1,
    depthMm: 44,
    weightKg: 6.4,
    powerConsumptionWatts: 5,
    maximumPowerWatts: 5,
    description:
      'Switched metered-by-outlet PDU with per-port control and environmental probes.',
    tags: ['pdu'],
    ports: [{ id: 'outlets', type: 'power', count: 24, label: 'C13 outlets' }],
    presentation: { faceplate: 'pdu', tone: 'dark', portsLabel: '24 outlets' },
  }),
];
