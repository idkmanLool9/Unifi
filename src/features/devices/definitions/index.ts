import { UBIQUITI_DEVICES } from './ubiquiti';
import { GENERIC_DEVICES } from './generic';
import type { DeviceDefinition } from '../deviceSchema';

/** All bundled device definitions, grouped for registry seeding. */
export const BUILTIN_DEFINITIONS: readonly DeviceDefinition[] = [
  ...UBIQUITI_DEVICES,
  ...GENERIC_DEVICES,
];
