import { useEffect, useMemo } from 'react';
import {
  allDevices,
  deviceModelUrl,
  useRegistryStore,
} from '@/features/devices/deviceRegistry';
import { compileEntry, type LibraryEntry } from './libraryIndex';
import { useLibraryMetaStore } from './libraryMetaStore';
import { useAssetStore } from '@/stores/assetStore';

/**
 * The compiled library: every registered definition joined with its
 * library metadata and model availability. Recompiles only when the
 * registry, the metadata store or an availability probe actually
 * changes — queries downstream are linear passes over this array.
 */
export function useLibraryEntries(): LibraryEntry[] {
  const registryVersion = useRegistryStore((s) => s.version);
  const deviceMeta = useLibraryMetaStore((s) => s.deviceMeta);
  const availability = useAssetStore((s) => s.availability);

  // Probe every device's model once, in the background.
  useEffect(() => {
    const probe = useAssetStore.getState().probe;
    for (const definition of allDevices()) {
      probe(deviceModelUrl(definition));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryVersion]);

  return useMemo(
    () =>
      allDevices().map((definition) =>
        compileEntry(
          definition,
          deviceMeta[definition.id] ?? {},
          availability[deviceModelUrl(definition)] === 'available',
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion, deviceMeta, availability],
  );
}
