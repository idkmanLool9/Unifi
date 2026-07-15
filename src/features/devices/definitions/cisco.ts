import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const CISCO_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'cisco-c9300-48p',
    slug: 'catalyst-9300-48p',
    manufacturer: 'cisco',
    manufacturerName: 'Cisco',
    productName: 'Catalyst 9300 48P',
    modelNumber: 'C9300-48P',
    category: 'switching',
    rackUnits: 1,
    depthMm: 445,
    weightKg: 7.9,
    powerConsumptionWatts: 120,
    maximumPowerWatts: 715,
    description:
      'Enterprise access switch with UPOE, StackWise-480 and modular uplinks.',
    tags: ['poe', 'enterprise'],
    ports: [
      { id: 'access', type: 'rj45', count: 48, label: 'UPOE 1–48' },
      { id: 'uplink', type: 'sfp+', count: 8, label: 'Modular uplinks' },
    ],
    presentation: {
      faceplate: 'network',
      tone: 'metal',
      portsLabel: '48 ports',
      speedLabel: '1G',
      poe: true,
    },
  }),
  defineDevice({
    id: 'cisco-n93180',
    slug: 'nexus-93180yc-fx3',
    manufacturer: 'cisco',
    manufacturerName: 'Cisco',
    productName: 'Nexus 93180YC-FX3',
    modelNumber: 'N9K-C93180YC-FX3',
    category: 'switching',
    rackUnits: 1,
    depthMm: 570,
    weightKg: 9.9,
    powerConsumptionWatts: 260,
    maximumPowerWatts: 440,
    description:
      'Leaf switch with 48 SFP28 ports and six QSFP28 uplinks for modern fabrics.',
    tags: ['datacenter', '25g', '100g'],
    ports: [
      { id: 'leaf', type: 'sfp28', count: 48, label: 'SFP28 1–48' },
      { id: 'spine', type: 'qsfp28', count: 6, label: 'QSFP28 uplinks' },
    ],
    presentation: {
      faceplate: 'network',
      tone: 'metal',
      portsLabel: '54 ports',
      speedLabel: '25G / 100G',
    },
  }),
];
