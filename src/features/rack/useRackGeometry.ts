import { useMemo } from 'react';
import { getDevice, useRegistryStore } from '@/features/devices/deviceRegistry';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import {
  deepestDeviceDepthMm,
  rackGeometryFor,
  type RackGeometry,
} from './rackMath';
import type { RackConfig } from '@/types';

/**
 * Live rack geometry for the current rack: resolves auto rail spacing
 * against the mounted devices, re-deriving when devices or the rail
 * configuration change.
 */
export function useRackGeometry(rack: RackConfig): RackGeometry {
  const instances = useDeviceInstancesStore((s) => s.instances);
  const registryVersion = useRegistryStore((s) => s.version);

  return useMemo(
    () => rackGeometryFor(rack, deepestDeviceDepthMm(instances, getDevice)),
    // eslint-style exhaustive deps: registryVersion re-derives after
    // external definitions load.
    [rack.profileId, rack.railMode, rack.railSpacingMm, instances, registryVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
