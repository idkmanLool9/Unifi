import { UBIQUITI_DEVICES } from './ubiquiti';
import { DELL_DEVICES } from './dell';
import { SYNOLOGY_DEVICES } from './synology';
import { APC_DEVICES } from './apc';
import { CISCO_DEVICES } from './cisco';
import { MIKROTIK_DEVICES } from './mikrotik';
import { SUPERMICRO_DEVICES } from './supermicro';
import { HPE_DEVICES } from './hpe';
import { NETGEAR_DEVICES } from './netgear';
import type { DeviceDefinition } from '../deviceSchema';

/** All bundled device definitions, grouped for registry seeding. */
export const BUILTIN_DEFINITIONS: readonly DeviceDefinition[] = [
  ...UBIQUITI_DEVICES,
  ...DELL_DEVICES,
  ...SYNOLOGY_DEVICES,
  ...APC_DEVICES,
  ...CISCO_DEVICES,
  ...MIKROTIK_DEVICES,
  ...SUPERMICRO_DEVICES,
  ...HPE_DEVICES,
  ...NETGEAR_DEVICES,
];
