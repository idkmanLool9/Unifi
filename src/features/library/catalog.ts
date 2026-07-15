/**
 * Placeholder device catalog — presentation data only, used to design the
 * library experience. The real catalog (backed by Supabase) replaces this
 * in a later milestone; the shapes here are deliberately UI-oriented.
 */

export type DeviceCategory =
  | 'routing'
  | 'switching'
  | 'servers'
  | 'storage'
  | 'power'
  | 'accessories';

export type FaceplateStyle = 'network' | 'server' | 'storage' | 'ups' | 'pdu';

export interface CatalogDevice {
  id: string;
  name: string;
  brandId: string;
  category: DeviceCategory;
  /** Rack height in units. */
  units: number;
  /** Total port count, when relevant. */
  ports?: number;
  /** Uplink/port speed label, when relevant. */
  speed?: string;
  poe?: boolean;
  weightKg: number;
  depthMm: number;
  powerW: number;
  description: string;
  badge?: 'popular' | 'new';
  /** Drives the procedural thumbnail faceplate. */
  faceplate: FaceplateStyle;
  /** Front panel tone for the thumbnail. */
  tone: 'dark' | 'metal';
}

export interface CatalogBrand {
  id: string;
  name: string;
  /** Two-letter monogram for the brand tile. */
  monogram: string;
  /** Brand tint for the monogram tile (used at low opacity). */
  tint: string;
}

export const CATALOG_BRANDS: readonly CatalogBrand[] = [
  { id: 'ubiquiti', name: 'Ubiquiti', monogram: 'Ub', tint: '#2f6bef' },
  { id: 'dell', name: 'Dell', monogram: 'De', tint: '#0f7bc4' },
  { id: 'synology', name: 'Synology', monogram: 'Sy', tint: '#8a8f99' },
  { id: 'apc', name: 'APC', monogram: 'AP', tint: '#c2483d' },
  { id: 'cisco', name: 'Cisco', monogram: 'Ci', tint: '#12a3b4' },
  { id: 'mikrotik', name: 'MikroTik', monogram: 'Mi', tint: '#5a8dd6' },
  { id: 'supermicro', name: 'Supermicro', monogram: 'Su', tint: '#3f9e5f' },
  { id: 'hpe', name: 'HPE', monogram: 'HP', tint: '#25b28a' },
  { id: 'tplink', name: 'TP-Link', monogram: 'TP', tint: '#3aa0d8' },
];

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  routing: 'Routing',
  switching: 'Switching',
  servers: 'Servers',
  storage: 'Storage',
  power: 'Power',
  accessories: 'Accessories',
};

export const CATALOG_DEVICES: readonly CatalogDevice[] = [
  // Ubiquiti
  {
    id: 'ubnt-udm-pro',
    name: 'Dream Machine Pro',
    brandId: 'ubiquiti',
    category: 'routing',
    units: 1,
    ports: 10,
    speed: '10G SFP+',
    weightKg: 3.9,
    depthMm: 286,
    powerW: 33,
    description:
      'All-in-one enterprise gateway with integrated switching, protect NVR and 10G uplinks.',
    badge: 'popular',
    faceplate: 'network',
    tone: 'dark',
  },
  {
    id: 'ubnt-usw-pro-48-poe',
    name: 'Pro 48 PoE',
    brandId: 'ubiquiti',
    category: 'switching',
    units: 1,
    ports: 52,
    speed: '1G / 10G',
    poe: true,
    weightKg: 5.9,
    depthMm: 400,
    powerW: 600,
    description:
      'Layer 3 switch with 48 GbE PoE+ ports, four 10G SFP+ uplinks and quiet adaptive cooling.',
    badge: 'popular',
    faceplate: 'network',
    tone: 'dark',
  },
  {
    id: 'ubnt-usw-pro-aggregation',
    name: 'Pro Aggregation',
    brandId: 'ubiquiti',
    category: 'switching',
    units: 1,
    ports: 32,
    speed: '10G / 25G',
    weightKg: 3.6,
    depthMm: 296,
    powerW: 60,
    description:
      'Aggregation switch with 28 SFP+ and four SFP28 ports for high-capacity cores.',
    faceplate: 'network',
    tone: 'dark',
  },
  {
    id: 'ubnt-unvr-pro',
    name: 'UNVR Pro',
    brandId: 'ubiquiti',
    category: 'storage',
    units: 2,
    ports: 2,
    speed: '10G SFP+',
    weightKg: 12.6,
    depthMm: 480,
    powerW: 210,
    description:
      'Network video recorder with seven hot-swap bays for around-the-clock camera retention.',
    faceplate: 'storage',
    tone: 'dark',
  },
  // Dell
  {
    id: 'dell-r660',
    name: 'PowerEdge R660',
    brandId: 'dell',
    category: 'servers',
    units: 1,
    weightKg: 18.2,
    depthMm: 748,
    powerW: 1100,
    description:
      'Dual-socket 1U compute node tuned for dense virtualization and scale-out workloads.',
    faceplate: 'server',
    tone: 'metal',
  },
  {
    id: 'dell-r760',
    name: 'PowerEdge R760',
    brandId: 'dell',
    category: 'servers',
    units: 2,
    weightKg: 28.3,
    depthMm: 772,
    powerW: 1400,
    description:
      'Flagship 2U platform with broad accelerator support and 24 NVMe-capable bays.',
    badge: 'popular',
    faceplate: 'server',
    tone: 'metal',
  },
  // Synology
  {
    id: 'syn-rs1221',
    name: 'RackStation RS1221+',
    brandId: 'synology',
    category: 'storage',
    units: 2,
    ports: 4,
    speed: '1G',
    weightKg: 8.0,
    depthMm: 306,
    powerW: 150,
    description:
      'Short-depth 8-bay NAS for SMB backup, file serving and surveillance archives.',
    faceplate: 'storage',
    tone: 'dark',
  },
  {
    id: 'syn-rs822',
    name: 'RackStation RS822+',
    brandId: 'synology',
    category: 'storage',
    units: 1,
    ports: 4,
    speed: '1G',
    weightKg: 6.5,
    depthMm: 307,
    powerW: 110,
    description:
      'Compact 4-bay NAS with optional 10G upgrade and hot-swappable drive trays.',
    faceplate: 'storage',
    tone: 'dark',
  },
  // APC
  {
    id: 'apc-smt1500rm',
    name: 'Smart-UPS 1500',
    brandId: 'apc',
    category: 'power',
    units: 2,
    weightKg: 27.6,
    depthMm: 457,
    powerW: 1000,
    description:
      'Line-interactive 1500VA UPS with pure sine output and network management slot.',
    badge: 'popular',
    faceplate: 'ups',
    tone: 'dark',
  },
  {
    id: 'apc-ap8861',
    name: 'Rack PDU 9000',
    brandId: 'apc',
    category: 'power',
    units: 1,
    ports: 24,
    weightKg: 6.4,
    depthMm: 44,
    powerW: 0,
    description:
      'Switched metered-by-outlet PDU with per-port control and environmental probes.',
    faceplate: 'pdu',
    tone: 'dark',
  },
  // Cisco
  {
    id: 'cisco-c9300-48p',
    name: 'Catalyst 9300 48P',
    brandId: 'cisco',
    category: 'switching',
    units: 1,
    ports: 48,
    speed: '1G',
    poe: true,
    weightKg: 7.9,
    depthMm: 445,
    powerW: 715,
    description:
      'Enterprise access switch with UPOE, StackWise-480 and modular uplinks.',
    faceplate: 'network',
    tone: 'metal',
  },
  {
    id: 'cisco-n93180',
    name: 'Nexus 93180YC-FX3',
    brandId: 'cisco',
    category: 'switching',
    units: 1,
    ports: 54,
    speed: '25G / 100G',
    weightKg: 9.9,
    depthMm: 570,
    powerW: 440,
    description:
      'Leaf switch with 48 SFP28 ports and six QSFP28 uplinks for modern fabrics.',
    faceplate: 'network',
    tone: 'metal',
  },
  // MikroTik
  {
    id: 'mt-ccr2216',
    name: 'CCR2216-1G-12XS-2XQ',
    brandId: 'mikrotik',
    category: 'routing',
    units: 1,
    ports: 15,
    speed: '25G / 100G',
    weightKg: 5.2,
    depthMm: 366,
    powerW: 91,
    description:
      'Sixteen-core cloud router with 25G SFP28 density and dual 100G uplinks.',
    badge: 'new',
    faceplate: 'network',
    tone: 'dark',
  },
  {
    id: 'mt-crs354',
    name: 'CRS354-48G-4S+2Q+',
    brandId: 'mikrotik',
    category: 'switching',
    units: 1,
    ports: 54,
    speed: '1G / 40G',
    weightKg: 3.9,
    depthMm: 285,
    powerW: 62,
    description:
      'Cost-effective 48-port access switch with SFP+ and QSFP+ aggregation.',
    faceplate: 'network',
    tone: 'dark',
  },
  // Supermicro
  {
    id: 'smc-sys-121c',
    name: 'SuperServer 121C',
    brandId: 'supermicro',
    category: 'servers',
    units: 1,
    weightKg: 16.8,
    depthMm: 737,
    powerW: 860,
    description:
      'Cloud-optimized 1U system with twelve DDR5 slots and tool-less NVMe bays.',
    faceplate: 'server',
    tone: 'metal',
  },
  // HPE
  {
    id: 'hpe-dl380-g11',
    name: 'ProLiant DL380 Gen11',
    brandId: 'hpe',
    category: 'servers',
    units: 2,
    weightKg: 27.1,
    depthMm: 713,
    powerW: 1600,
    description:
      'The industry-standard 2U workhorse with iLO 6 and flexible storage cages.',
    faceplate: 'server',
    tone: 'metal',
  },
  {
    id: 'hpe-dl20-g11',
    name: 'ProLiant DL20 Gen11',
    brandId: 'hpe',
    category: 'servers',
    units: 1,
    weightKg: 8.4,
    depthMm: 438,
    powerW: 500,
    description:
      'Short-depth single-socket server for edge and branch deployments.',
    faceplate: 'server',
    tone: 'metal',
  },
];

export const deviceById = (id: string): CatalogDevice | undefined =>
  CATALOG_DEVICES.find((d) => d.id === id);

export const brandById = (id: string): CatalogBrand | undefined =>
  CATALOG_BRANDS.find((b) => b.id === id);

export const devicesByBrand = (brandId: string): CatalogDevice[] =>
  CATALOG_DEVICES.filter((d) => d.brandId === brandId);
