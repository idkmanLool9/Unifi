import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { registerDevice } from '@/features/devices/deviceRegistry';
import { DEVICE_CATEGORIES } from '@/features/devices/deviceSchema';
import { useAuthoredDevicesStore } from '@/stores/authoredDevicesStore';
import { useAssetStore } from '@/stores/assetStore';
import { toast } from '@/stores/toastStore';
import { importDeviceFile, type DraftFields } from './packageImport';
import { storeModelForDevice } from './modelBlobStore';
import { IDB_MODEL_PREFIX } from './modelBlobStore';
import { useLibraryMetaStore } from './libraryMetaStore';
import type { DeviceCategory } from '@/features/devices/deviceSchema';

/**
 * Import flow: pick a GLB/GLTF/OBJ/FBX/ZIP, describe the hardware in a
 * few fields (ZIP packages bring their own metadata), and the device
 * registers, persists (metadata in localStorage, model in IndexedDB)
 * and opens straight in Device Authoring.
 */

const inputClass =
  'h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary focus:border-accent focus:outline-none';

export function ImportDeviceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFields>({
    name: '',
    manufacturerName: '',
    category: 'switching',
    rackUnits: 1,
    widthMm: 442,
    heightMm: 44,
    depthMm: 300,
  });

  const isZip = file?.name.toLowerCase().endsWith('.zip') ?? false;
  const canImport = file !== null && (isZip || draft.name.trim().length > 0);

  const reset = () => {
    setFile(null);
    setError(null);
    setBusy(false);
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { definition, modelBlob } = await importDeviceFile(file, draft);

      let final = definition;
      if (modelBlob) {
        const url = await storeModelForDevice(definition.id, modelBlob);
        final = { ...definition, frontModelPath: url };
        // Persisted copy references IndexedDB; rehydrated on startup.
        useAuthoredDevicesStore.getState().saveDefinition(definition.id, {
          ...definition,
          frontModelPath: `${IDB_MODEL_PREFIX}${definition.id}`,
        });
        useAssetStore.setState((s) => ({
          availability: { ...s.availability, [url]: 'available' },
        }));
      } else {
        useAuthoredDevicesStore.getState().saveDefinition(final.id, final);
      }
      registerDevice(final);
      useLibraryMetaStore.getState().patchMeta(final.id, {
        author: 'Imported',
        version: '0.1.0',
      });
      useLibraryMetaStore
        .getState()
        .addChangelog(final.id, `Imported from ${file.name}`);

      toast({ variant: 'success', title: `${final.productName} imported` });
      reset();
      onClose();
      void navigate(`/author?device=${final.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import device"
      width={440}
    >
      <div className="space-y-3 p-4 pt-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-edge-strong text-secondary transition-colors hover:border-accent hover:text-primary"
        >
          <FileUp className="size-5" strokeWidth={1.5} />
          <span className="text-xs font-medium">
            {file ? file.name : 'Choose GLB, GLTF, OBJ, FBX or ZIP package'}
          </span>
          {file && (
            <span className="text-[10px] text-muted">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf,.obj,.fbx,.zip"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setFile(picked);
            setError(null);
            if (picked && !draft.name) {
              setDraft((d) => ({
                ...d,
                name: picked.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
              }));
            }
          }}
        />

        {!isZip && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-secondary">Device name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-secondary">Manufacturer</span>
                <input
                  type="text"
                  placeholder="Custom"
                  value={draft.manufacturerName}
                  onChange={(e) =>
                    setDraft({ ...draft, manufacturerName: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-secondary">Category</span>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as DeviceCategory,
                    })
                  }
                  className={inputClass}
                >
                  {DEVICE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-secondary">Rack units</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={draft.rackUnits}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rackUnits: Math.max(1, Number(e.target.value) || 1),
                      heightMm: Math.max(1, Number(e.target.value) || 1) * 44,
                    })
                  }
                  className={inputClass}
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['widthMm', 'Width (mm)'],
                  ['heightMm', 'Height (mm)'],
                  ['depthMm', 'Depth (mm)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-xs text-secondary">{label}</span>
                  <input
                    type="number"
                    min={10}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]: Math.max(10, Number(e.target.value) || 10),
                      })
                    }
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </>
        )}
        {isZip && (
          <p className="text-[11px] leading-snug text-muted">
            ZIP packages restore their own metadata (metadata.json +
            model.glb). Devices without metadata use the fields above.
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-danger/10 px-2.5 py-2 text-[11px] leading-snug text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!canImport || busy}
          onClick={() => void runImport()}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Importing…
            </>
          ) : (
            'Import & open in Authoring'
          )}
        </button>
      </div>
    </Dialog>
  );
}
