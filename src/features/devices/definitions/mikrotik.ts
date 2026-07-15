import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const MIKROTIK_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'mt-ccr2216',
    slug: 'ccr2216',
    manufacturer: 'mikrotik',
    manufacturerName: 'MikroTik',
    productName: 'CCR2216-1G-12XS-2XQ',
    modelNumber: 'CCR2216-1G-12XS-2XQ',
    category: 'routing',
    rackUnits: 1,
    depthMm: 366,
    weightKg: 5.2,
    powerConsumptionWatts: 55,
    maximumPowerWatts: 91,
    description:
      'Sixteen-core cloud router with 25G SFP28 density and dual 100G uplinks.',
    tags: ['router', '25g', '100g', 'new'],
    ports: [
      { id: 'mgmt', type: 'rj45', count: 1, label: 'Management' },
      { id: 'sfp28', type: 'sfp28', count: 12, label: 'SFP28 1–12' },
      { id: 'qsfp28', type: 'qsfp28', count: 2, label: 'QSFP28 uplinks' },
    ],
    presentation: {
      faceplate: 'network',
      tone: 'dark',
      badge: 'new',
      portsLabel: '15 ports',
      speedLabel: '25G / 100G',
    },
  }),
  defineDevice({
    id: 'mt-crs354',
    slug: 'crs354',
    manufacturer: 'mikrotik',
    manufacturerName: 'MikroTik',
    productName: 'CRS354-48G-4S+2Q+',
    modelNumber: 'CRS354-48G-4S+2Q+RM',
    category: 'switching',
    rackUnits: 1,
    depthMm: 285,
    weightKg: 3.9,
    powerConsumptionWatts: 40,
    maximumPowerWatts: 62,
    description:
      'Cost-effective 48-port access switch with SFP+ and QSFP+ aggregation.',
    tags: ['switch', 'value'],
    ports: [
      { id: 'access', type: 'rj45', count: 48, label: 'GbE 1–48' },
      { id: 'sfp', type: 'sfp+', count: 4, label: 'SFP+' },
      { id: 'qsfp', type: 'qsfp+', count: 2, label: 'QSFP+' },
    ],
    presentation: {
      faceplate: 'network',
      tone: 'dark',
      portsLabel: '54 ports',
      speedLabel: '1G / 40G',
    },
  }),
];
