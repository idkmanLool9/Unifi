/**
 * Manufacturer identity cards for the library sidebar: accent, monogram
 * logo, one-line description and website. Unknown manufacturers get a
 * derived identity — the library never breaks on new metadata.
 */

export interface ManufacturerInfo {
  id: string;
  name: string;
  monogram: string;
  accent: string;
  description: string;
  website?: string;
}

const KNOWN: Record<string, Omit<ManufacturerInfo, 'id' | 'name'>> = {
  ubiquiti: {
    monogram: 'Ub',
    accent: '#2f6bef',
    description: 'UniFi networking, protect and access hardware.',
    website: 'https://ui.com',
  },
  cisco: {
    monogram: 'Ci',
    accent: '#12a3b4',
    description: 'Enterprise networking and security.',
    website: 'https://cisco.com',
  },
  juniper: {
    monogram: 'Ju',
    accent: '#57a83f',
    description: 'High-performance routing and switching.',
    website: 'https://juniper.net',
  },
  dell: {
    monogram: 'De',
    accent: '#0f7bc4',
    description: 'PowerEdge servers and infrastructure.',
    website: 'https://dell.com',
  },
  hpe: {
    monogram: 'HP',
    accent: '#25b28a',
    description: 'ProLiant servers, Aruba networking.',
    website: 'https://hpe.com',
  },
  lenovo: {
    monogram: 'Le',
    accent: '#d4574e',
    description: 'ThinkSystem servers and storage.',
    website: 'https://lenovo.com',
  },
  mikrotik: {
    monogram: 'Mi',
    accent: '#5a8dd6',
    description: 'RouterOS routers and switches.',
    website: 'https://mikrotik.com',
  },
  tplink: {
    monogram: 'TP',
    accent: '#3aa0d8',
    description: 'Omada business networking.',
    website: 'https://tp-link.com',
  },
  netgear: {
    monogram: 'Ne',
    accent: '#3f4d9e',
    description: 'ProSafe switching and storage.',
    website: 'https://netgear.com',
  },
  synology: {
    monogram: 'Sy',
    accent: '#8a8f99',
    description: 'RackStation NAS and backup.',
    website: 'https://synology.com',
  },
  supermicro: {
    monogram: 'Su',
    accent: '#3f9e5f',
    description: 'SuperServer building blocks.',
    website: 'https://supermicro.com',
  },
  apc: {
    monogram: 'AP',
    accent: '#c2483d',
    description: 'Smart-UPS power protection.',
    website: 'https://apc.com',
  },
  generic: {
    monogram: 'Ge',
    accent: '#8a8f99',
    description: 'Brand-independent rack hardware.',
  },
  custom: {
    monogram: 'Cu',
    accent: '#8f6fe8',
    description: 'Devices imported into this library.',
  },
};

export function manufacturerInfo(id: string, name: string): ManufacturerInfo {
  const known = KNOWN[id];
  if (known) return { id, name, ...known };
  return {
    id,
    name,
    monogram: (name || id).slice(0, 2),
    accent: '#8a8f99',
    description: 'Imported manufacturer.',
  };
}
