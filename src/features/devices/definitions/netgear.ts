import { defineDevice } from './defineDevice';
import type { DeviceDefinition } from '../deviceSchema';

export const NETGEAR_DEVICES: DeviceDefinition[] = [
  defineDevice({
    id: 'ng-m4300-24x',
    slug: 'm4300-24x',
    manufacturer: 'netgear',
    manufacturerName: 'Netgear',
    productName: 'M4300-24X',
    modelNumber: 'XSM4324CS',
    category: 'switching',
    rackUnits: 1,
    widthMm: 440,
    heightMm: 43.2,
    depthMm: 430,
    weightKg: 6.24,
    powerConsumptionWatts: 168,
    maximumPowerWatts: 214,
    description:
      'Stackable 10-Gigabit aggregation switch with 24 10GBASE-T ports and shared SFP+ uplinks.',
    tags: ['switch', '10g', 'stackable'],
    ports: [
      { id: 'tengbaset-top', type: 'rj45', count: 12, label: '10GBASE-T (top row)', row: 0, speedGbps: 10 },
      { id: 'tengbaset-bottom', type: 'rj45', count: 12, label: '10GBASE-T (bottom row)', row: 1, speedGbps: 10 },
      { id: 'sfp', type: 'sfp+', count: 4, label: 'SFP+ shared 21–24', row: 0, speedGbps: 10 },
      { id: 'console', type: 'console', count: 1, label: 'Console', row: 1 },
      { id: 'usb', type: 'usb-a', count: 1, label: 'USB storage', row: 1 },
    ],
    power: {
      connectors: [{ id: 'ac', type: 'c14', count: 1, location: 'rear' }],
    },
    cooling: { fanCount: 3, airflow: 'side-to-side' },
    presentation: {
      faceplate: 'network',
      tone: 'dark',
      portsLabel: '28 ports',
      speedLabel: '10G',
    },
  }),
  defineDevice({
    id: 'ng-m4250-26g4xf-poe',
    slug: 'm4250-26g4xf-poe',
    manufacturer: 'netgear',
    manufacturerName: 'Netgear',
    productName: 'M4250-26G4XF-PoE+',
    modelNumber: 'GSM4230PX',
    category: 'switching',
    rackUnits: 1,
    widthMm: 440,
    heightMm: 43.2,
    depthMm: 350,
    weightKg: 5.36,
    powerConsumptionWatts: 60,
    maximumPowerWatts: 340,
    description:
      'AV-line PoE+ access switch with 24 Gigabit PoE+ ports and four 10G fiber uplinks.',
    tags: ['switch', 'poe', 'av'],
    ports: [
      { id: 'poe-top', type: 'rj45', count: 12, label: 'GbE PoE+ (top row)', row: 0, speedGbps: 1, poe: true },
      { id: 'poe-bottom', type: 'rj45', count: 12, label: 'GbE PoE+ (bottom row)', row: 1, speedGbps: 1, poe: true },
      { id: 'gbe', type: 'rj45', count: 2, label: 'GbE 25–26', row: 0, speedGbps: 1 },
      { id: 'sfp', type: 'sfp+', count: 4, label: 'SFP+ uplinks', row: 1, speedGbps: 10 },
    ],
    power: {
      connectors: [{ id: 'ac', type: 'c14', count: 1, location: 'rear' }],
      poeBudgetW: 236,
      sources: ['ac'],
    },
    cooling: { fanCount: 2, airflow: 'side-to-side' },
    presentation: {
      faceplate: 'network',
      tone: 'dark',
      portsLabel: '30 ports',
      speedLabel: '1G / 10G',
      poe: true,
    },
  }),
];
