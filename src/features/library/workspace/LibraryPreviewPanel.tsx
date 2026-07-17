import { Suspense, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { CameraControls, ContactShadows } from '@react-three/drei';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CircleCheck,
  FileDown,
  Info,
  Package,
  PlusSquare,
  Wrench,
} from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Switch } from '@/components/ui/Switch';
import { InfoRow } from '@/features/inspector/InfoRow';
import { metadataJson } from '@/features/authoring/authoringModel';
import {
  deviceModelUrl,
  getDevice,
  registerDevice,
} from '@/features/devices/deviceRegistry';
import { DEVICE_CATEGORIES } from '@/features/devices/deviceSchema';
import { DevicePlaceholder } from '@/features/devices/DevicePlaceholder';
import { LoadedModel } from '@/features/devices/DeviceModel';
import { HardwareLayer } from '@/features/devices/hardware/HardwareLayer';
import { SceneLighting } from '@/features/viewport/SceneLighting';
import { useLibraryMetaStore } from './libraryMetaStore';
import { useAssetAvailability } from '@/stores/assetStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { toast } from '@/stores/toastStore';
import { MM_TO_M } from '@/features/rack/rackMath';
import { cn } from '@/lib/utils';
import type { LibraryEntry, ReadinessIssue } from './libraryIndex';
import type {
  DeviceCategory,
  DeviceDefinition,
} from '@/features/devices/deviceSchema';

/**
 * The library's right panel: an interactive 3D preview, the full
 * specification sheet, production-readiness checklist, and an
 * inspector whose every field saves instantly — definition edits
 * re-register the device and persist as patches, library metadata
 * saves beside it.
 */

const inputClass =
  'h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary focus:border-accent focus:outline-none';

export function LibraryPreviewPanel({ entry }: { entry: LibraryEntry }) {
  const definition = entry.definition;
  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-edge bg-surface">
      <Preview3D definition={definition} />
      <Actions entry={entry} />
      <ReadinessSection issues={entry.issues} verified={entry.verified} />
      <SpecsSection entry={entry} />
      <InspectorSection entry={entry} />
      <VersionSection entry={entry} />
    </aside>
  );
}

/* ---- 3D preview ------------------------------------------------------- */

function Preview3D({ definition }: { definition: DeviceDefinition }) {
  const url = deviceModelUrl(definition);
  const availability = useAssetAvailability(url);
  const lift = (definition.heightMm / 2) * MM_TO_M;
  const w = definition.widthMm * MM_TO_M;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="relative h-[210px] shrink-0 border-b border-edge bg-raised/40">
      <Canvas
        ref={canvasRef}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ position: [w * 1.15, lift + w * 0.5, w * 1.5], fov: 40, near: 0.005, far: 20 }}
      >
        <SceneLighting />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={1.6} blur={2.4} far={0.6} resolution={256} />
        <group position={[0, lift + 0.02, 0]}>
          {availability === 'available' ? (
            <Suspense fallback={<DevicePlaceholder definition={definition} />}>
              <LoadedModel url={url} definition={definition} />
            </Suspense>
          ) : (
            <>
              <DevicePlaceholder definition={definition} />
              <HardwareLayer definition={definition} mode="full" />
            </>
          )}
        </group>
        <CameraControls makeDefault minDistance={0.05} maxDistance={4} smoothTime={0.18} />
      </Canvas>
      <button
        type="button"
        title="Save preview as PNG thumbnail"
        onClick={() => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const link = document.createElement('a');
          link.download = `${definition.slug}-thumbnail.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          toast({ variant: 'success', title: 'Thumbnail exported' });
        }}
        className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-lg border border-edge bg-surface/85 text-secondary backdrop-blur transition-colors hover:text-primary"
      >
        <Camera className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/* ---- actions ---------------------------------------------------------- */

function download(filename: string, text: string, type = 'application/json') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function Actions({ entry }: { entry: LibraryEntry }) {
  const navigate = useNavigate();
  const addDevice = useDeviceInstancesStore((s) => s.addDevice);

  const exportMetadata = () =>
    download(`${entry.definition.slug}-metadata.json`, metadataJson(entry.definition));

  const exportPackage = () => {
    const pkg = {
      format: 'rackforge-package@1',
      exportedAt: new Date().toISOString(),
      metadata: JSON.parse(metadataJson(entry.definition)),
      library: entry.meta,
    };
    download(`${entry.definition.slug}.rackforge.json`, JSON.stringify(pkg, null, 2));
    toast({ variant: 'success', title: 'Device package exported' });
  };

  return (
    <div className="grid grid-cols-2 gap-1.5 border-b border-edge p-2.5">
      <button
        type="button"
        onClick={() => {
          const result = addDevice(entry.id);
          if (result.ok) {
            toast({ variant: 'success', title: 'Mounted in the rack' });
            void navigate('/');
          } else {
            toast({ variant: 'error', title: result.message });
          }
        }}
        className="flex h-7 items-center justify-center gap-1.5 rounded-lg bg-accent text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        <PlusSquare className="size-3.5" strokeWidth={1.75} />
        Add to rack
      </button>
      <button
        type="button"
        onClick={() => void navigate(`/author?device=${entry.id}`)}
        className="flex h-7 items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
      >
        <Wrench className="size-3.5" strokeWidth={1.75} />
        Author
      </button>
      <button
        type="button"
        onClick={exportMetadata}
        className="flex h-7 items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
      >
        <FileDown className="size-3.5" strokeWidth={1.75} />
        Metadata
      </button>
      <button
        type="button"
        onClick={exportPackage}
        className="flex h-7 items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
      >
        <Package className="size-3.5" strokeWidth={1.75} />
        Package
      </button>
    </div>
  );
}

/* ---- readiness -------------------------------------------------------- */

function ReadinessSection({
  issues,
  verified,
}: {
  issues: ReadinessIssue[];
  verified: boolean;
}) {
  return (
    <CollapsibleSection title="Production readiness">
      {verified ? (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <BadgeCheck className="size-4" strokeWidth={1.75} />
          Verified — ready for production
        </div>
      ) : issues.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CircleCheck className="size-4" strokeWidth={1.75} />
          Ready for production
        </div>
      ) : (
        <ul className="space-y-1">
          {issues.map((issue) => (
            <li
              key={issue.code}
              className={cn(
                'flex items-start gap-1.5 text-[11px] leading-snug',
                issue.level === 'blocker'
                  ? 'text-danger'
                  : issue.level === 'todo'
                    ? 'text-warning'
                    : 'text-muted',
              )}
            >
              {issue.level === 'info' ? (
                <Info className="mt-0.5 size-3 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              )}
              {issue.label}
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}

/* ---- specs ------------------------------------------------------------ */

function SpecsSection({ entry }: { entry: LibraryEntry }) {
  const d = entry.definition;
  return (
    <CollapsibleSection title="Specifications">
      <InfoRow label="Model">{d.modelNumber}</InfoRow>
      <InfoRow label="Rack units">{d.rackUnits}U</InfoRow>
      <InfoRow label="Dimensions">
        {d.widthMm} × {d.heightMm} × {d.depthMm} mm
      </InfoRow>
      <InfoRow label="Weight">{d.weightKg} kg</InfoRow>
      <InfoRow label="Power">
        {d.powerConsumptionWatts} W ({d.maximumPowerWatts} W max)
      </InfoRow>
      <InfoRow label="Ports">
        {entry.portCount > 0
          ? `${entry.portCount} (${entry.portTypes.join(', ').toUpperCase()})`
          : '—'}
      </InfoRow>
      {entry.poe && <InfoRow label="PoE">Yes</InfoRow>}
      {entry.etherlighting && <InfoRow label="Etherlighting">Yes</InfoRow>}
      <InfoRow label="LEDs">{entry.ledCount || '—'}</InfoRow>
      {entry.hasDisplay && <InfoRow label="Display">LCD</InfoRow>}
      {entry.hasCooling && (
        <InfoRow label="Cooling">
          {d.cooling?.fanPositionsMm?.length
            ? `${d.cooling.fanPositionsMm.length} fans`
            : 'Passive/side'}
        </InfoRow>
      )}
    </CollapsibleSection>
  );
}

/* ---- inspector (instant save) ----------------------------------------- */

function InspectorSection({ entry }: { entry: LibraryEntry }) {
  const patchMeta = useLibraryMetaStore((s) => s.patchMeta);
  const setDefinitionPatch = useLibraryMetaStore((s) => s.setDefinitionPatch);
  const customCategories = useLibraryMetaStore((s) => s.customCategories);
  const d = entry.definition;

  // Definition-level edit: live re-register + persisted patch.
  const editDefinition = (patch: Partial<DeviceDefinition>) => {
    const current = getDevice(d.id);
    if (!current) return;
    registerDevice({ ...current, ...patch });
    setDefinitionPatch(d.id, patch as Record<string, unknown>);
    patchMeta(d.id, {}); // stamps updatedAt
  };

  return (
    <CollapsibleSection title="Inspector">
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs text-secondary">Name</span>
          <input
            type="text"
            value={d.productName}
            onChange={(e) => editDefinition({ productName: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-secondary">Description</span>
          <textarea
            rows={2}
            value={d.description}
            onChange={(e) => editDefinition({ description: e.target.value })}
            className="w-full rounded-lg border border-edge bg-surface-raised px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-secondary">Tags (comma separated)</span>
          <input
            type="text"
            value={d.tags.join(', ')}
            onChange={(e) =>
              editDefinition({
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-secondary">Category</span>
          <select
            value={d.category}
            onChange={(e) =>
              editDefinition({ category: e.target.value as DeviceCategory })
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
        {customCategories.length > 0 && (
          <label className="block space-y-1">
            <span className="text-xs text-secondary">Custom category</span>
            <select
              value={entry.meta.customCategoryId ?? ''}
              onChange={(e) =>
                patchMeta(d.id, {
                  customCategoryId: e.target.value || undefined,
                })
              }
              className={inputClass}
            >
              <option value="">None</option>
              {customCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary">Visible in editor palette</span>
          <Switch
            label="Device visibility"
            checked={!entry.meta.hidden}
            onChange={(visible) => patchMeta(d.id, { hidden: !visible })}
          />
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-secondary">Notes</span>
          <textarea
            rows={2}
            placeholder="Internal notes…"
            value={entry.meta.notes ?? ''}
            onChange={(e) =>
              patchMeta(d.id, { notes: e.target.value || undefined })
            }
            className="w-full rounded-lg border border-edge bg-surface-raised px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </CollapsibleSection>
  );
}

/* ---- versioning ------------------------------------------------------- */

function VersionSection({ entry }: { entry: LibraryEntry }) {
  const patchMeta = useLibraryMetaStore((s) => s.patchMeta);
  const addChangelog = useLibraryMetaStore((s) => s.addChangelog);
  const [note, setNote] = useState('');
  const meta = entry.meta;

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : '—';

  const changelog = useMemo(
    () => [...(meta.changelog ?? [])].reverse(),
    [meta.changelog],
  );

  return (
    <CollapsibleSection title="Version & history" defaultOpen={false}>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block space-y-1">
            <span className="text-xs text-secondary">Version</span>
            <input
              type="text"
              placeholder="1.0.0"
              value={meta.version ?? ''}
              onChange={(e) =>
                patchMeta(entry.id, { version: e.target.value || undefined })
              }
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-secondary">Author</span>
            <input
              type="text"
              placeholder="You"
              value={meta.author ?? ''}
              onChange={(e) =>
                patchMeta(entry.id, { author: e.target.value || undefined })
              }
              className={inputClass}
            />
          </label>
        </div>
        <InfoRow label="Created">{formatDate(meta.createdAt)}</InfoRow>
        <InfoRow label="Updated">{formatDate(meta.updatedAt)}</InfoRow>

        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Changelog entry…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && note.trim()) {
                addChangelog(entry.id, note.trim());
                setNote('');
              }
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => {
              if (note.trim()) {
                addChangelog(entry.id, note.trim());
                setNote('');
              }
            }}
            className="h-7 shrink-0 rounded-lg border border-edge px-2 text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
          >
            Log
          </button>
        </div>
        {changelog.length > 0 && (
          <ul className="space-y-1">
            {changelog.map((c, i) => (
              <li key={i} className="text-[10.5px] leading-snug text-muted">
                <span className="text-secondary">
                  {new Date(c.at).toLocaleDateString()}
                </span>{' '}
                — {c.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  );
}
