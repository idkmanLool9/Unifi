/**
 * IndexedDB storage for imported 3D models. Definitions created through
 * the library's import flow reference their model as `idb:<deviceId>`;
 * at startup every stored blob is rehydrated into an object URL and the
 * definition re-registered with it, so imported hardware loads through
 * the exact same GLB pipeline as bundled assets.
 */

const DB_NAME = 'rackforge-assets';
const STORE = 'models';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveModelBlob(deviceId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, deviceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadModelBlob(deviceId: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(deviceId);
    request.onsuccess = () => resolve((request.result as Blob) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

/** Every stored model, keyed by device id (project export). */
export async function listModelBlobs(): Promise<
  Array<{ deviceId: string; blob: Blob }>
> {
  const db = await openDb();
  const entries = await new Promise<Array<{ deviceId: string; blob: Blob }>>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const keys = store.getAllKeys();
      const values = store.getAll();
      tx.oncomplete = () =>
        resolve(
          keys.result.map((key, i) => ({
            deviceId: String(key),
            blob: values.result[i] as Blob,
          })),
        );
      tx.onerror = () => reject(tx.error);
    },
  );
  db.close();
  return entries;
}

export async function deleteModelBlob(deviceId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(deviceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Removes every stored model (project import replaces the set). */
export async function clearModelBlobs(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** The definition path marker for IDB-stored models. */
export const IDB_MODEL_PREFIX = 'idb:';

/** Object URLs handed out this session, keyed by device id. */
const objectUrls = new Map<string, string>();

/** Resolves `idb:<id>` to a stable object URL for this session. */
export async function resolveIdbModelUrl(deviceId: string): Promise<string | null> {
  const cached = objectUrls.get(deviceId);
  if (cached) return cached;
  const blob = await loadModelBlob(deviceId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(deviceId, url);
  return url;
}

/** Registers a fresh blob for a device and returns its object URL. */
export async function storeModelForDevice(
  deviceId: string,
  blob: Blob,
): Promise<string> {
  await saveModelBlob(deviceId, blob);
  const previous = objectUrls.get(deviceId);
  if (previous) URL.revokeObjectURL(previous);
  const url = URL.createObjectURL(blob);
  objectUrls.set(deviceId, url);
  return url;
}
