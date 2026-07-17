import { allDevices, registerDevice } from '@/features/devices/deviceRegistry';
import { IDB_MODEL_PREFIX, resolveIdbModelUrl } from './modelBlobStore';
import { useLibraryMetaStore } from './libraryMetaStore';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * Library startup layers, applied AFTER built-ins, external metadata
 * and browser-authored definitions have registered:
 *
 *  1. definition patches — inspector edits to any device (including
 *     built-ins) re-apply over whatever registered underneath, and
 *  2. imported-model rehydration — definitions whose model lives in
 *     IndexedDB (`idb:<id>`) get a fresh object URL for this session.
 */
export async function applyLibraryLayers(): Promise<void> {
  const { definitionPatches } = useLibraryMetaStore.getState();

  for (const definition of allDevices()) {
    const patch = definitionPatches[definition.id];
    if (patch && Object.keys(patch).length > 0) {
      registerDevice({ ...definition, ...patch } as DeviceDefinition);
    }
  }

  await Promise.all(
    allDevices()
      .filter((d) => d.frontModelPath?.startsWith(IDB_MODEL_PREFIX))
      .map(async (definition) => {
        const url = await resolveIdbModelUrl(definition.id);
        if (url) {
          registerDevice({ ...definition, frontModelPath: url });
        }
      }),
  );
}
