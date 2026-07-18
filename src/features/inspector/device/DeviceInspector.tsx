import { useState } from 'react';
import {
  Minus,
  PencilRuler,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { CableManagementSection } from './CableManagementSection';
import { EtherlightingDeviceSection } from './EtherlightingDeviceSection';
import { ConnectionsSection } from './ConnectionsSection';
import { HardwareSection } from './HardwareSection';
import { InfoRow } from '../InfoRow';
import { requestRemoveDevice } from '@/features/devices/removeDeviceAction';
import {
  getDevice,
  isBuiltinDevice,
  resetDeviceToBuiltin,
} from '@/features/devices/deviceRegistry';
import { useAuthoredDevicesStore } from '@/stores/authoredDevicesStore';
import { toast } from '@/stores/toastStore';
import { CATEGORY_LABELS } from '@/features/library/catalog';
import {
  rotatedFootprintMm,
  shelfDeckRect,
  type PlacedDevice,
} from '@/features/rack/rackMath';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { RackOrientation } from '@/types';

const FACING_OPTIONS: ReadonlyArray<{
  value: RackOrientation;
  label: string;
}> = [
  { value: 'front', label: 'Front' },
  { value: 'rear', label: 'Rear' },
];

function ProductSection({ definition }: { definition: DeviceDefinition }) {
  return (
    <CollapsibleSection title="Device">
      <InfoRow label="Product">{definition.productName}</InfoRow>
      <InfoRow label="Manufacturer">{definition.manufacturerName}</InfoRow>
      <InfoRow label="Model">{definition.modelNumber}</InfoRow>
      <InfoRow label="Category">
        {CATEGORY_LABELS[definition.category]}
      </InfoRow>
      <InfoRow label="Status">
        <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
          Mounted
        </span>
      </InfoRow>
    </CollapsibleSection>
  );
}

/** Placement controls for a device standing on a shelf: slide it
 *  across the deck, rotate it, and see which shelf carries it. */
function ShelfPlacementSection({
  instance,
  definition,
}: {
  instance: PlacedDevice;
  definition: DeviceDefinition;
}) {
  const moveOnShelf = useDeviceInstancesStore((s) => s.moveOnShelf);
  const rotateOnShelf = useDeviceInstancesStore((s) => s.rotateOnShelf);
  const setVisible = useDeviceInstancesStore((s) => s.setVisible);
  const shelfInstance = useDeviceInstancesStore((s) =>
    s.instances.find((i) => i.id === instance.surface?.shelfId),
  );
  const [error, setError] = useState<string | null>(null);

  const surface = instance.surface!;
  const shelfDefinition = shelfInstance && getDevice(shelfInstance.definitionId);
  const deck = shelfDefinition ? shelfDeckRect(shelfDefinition) : null;
  const foot = rotatedFootprintMm(
    definition.widthMm,
    definition.depthMm,
    surface.rotationDeg,
  );
  const boundX = deck ? Math.max(0, (deck.wMm - foot.wMm) / 2) : 0;
  const boundZ = deck ? Math.max(0, (deck.dMm - foot.dMm) / 2) : 0;

  const report = (result: { ok: boolean } & { message?: string }) =>
    setError(result.ok ? null : (result.message ?? null));

  return (
    <CollapsibleSection title="Placement">
      <div className="space-y-2.5">
        <InfoRow label="Standing on">
          {shelfDefinition?.productName ?? 'Shelf'} · U{instance.startU}
        </InfoRow>
        <Slider
          label="Across the shelf"
          value={surface.xMm}
          min={-Math.round(boundX)}
          max={Math.round(boundX)}
          step={1}
          onChange={(xMm) => report(moveOnShelf(instance.id, xMm, surface.zMm))}
          format={(v) => `${Math.round(v)} mm`}
        />
        <Slider
          label="Front to back"
          value={surface.zMm}
          min={-Math.round(boundZ)}
          max={Math.round(boundZ)}
          step={1}
          onChange={(zMm) => report(moveOnShelf(instance.id, surface.xMm, zMm))}
          format={(v) => `${Math.round(v)} mm`}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-secondary">Rotation</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Rotate 90 degrees counter-clockwise"
              onClick={() =>
                report(rotateOnShelf(instance.id, surface.rotationDeg + 90))
              }
              className="flex size-6 items-center justify-center rounded-md border border-edge text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <RotateCcw className="size-3" strokeWidth={2} />
            </button>
            <span className="min-w-[44px] text-center text-[11px] font-medium text-primary tabular-nums">
              {surface.rotationDeg}°
            </span>
            <button
              type="button"
              aria-label="Rotate 90 degrees clockwise"
              onClick={() =>
                report(rotateOnShelf(instance.id, surface.rotationDeg - 90))
              }
              className="flex size-6 items-center justify-center rounded-md border border-edge text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <RotateCw className="size-3" strokeWidth={2} />
            </button>
          </div>
        </div>
        <Slider
          label="Fine rotation"
          value={surface.rotationDeg}
          min={0}
          max={355}
          step={5}
          onChange={(deg) => report(rotateOnShelf(instance.id, deg))}
          format={(v) => `${Math.round(v)}°`}
        />
        {error && (
          <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[11px] leading-snug text-danger">
            {error}
          </p>
        )}
        <div className="flex h-7 items-center justify-between">
          <span className="text-xs text-secondary">Visible</span>
          <Switch
            label="Device visible"
            checked={instance.visible}
            onChange={(visible) => setVisible(instance.id, visible)}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

function PlacementSection({
  instance,
  definition,
}: {
  instance: PlacedDevice;
  definition: DeviceDefinition;
}) {
  const moveDevice = useDeviceInstancesStore((s) => s.moveDevice);
  const setFacing = useDeviceInstancesStore((s) => s.setFacing);
  const setVisible = useDeviceInstancesStore((s) => s.setVisible);
  const [error, setError] = useState<string | null>(null);

  const endU = instance.startU + definition.rackUnits - 1;

  const tryMove = (startU: number) => {
    const result = moveDevice(instance.id, startU);
    setError(result.ok ? null : result.message);
  };

  return (
    <CollapsibleSection title="Placement">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-secondary">Rack position</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move down one unit"
              onClick={() => tryMove(instance.startU - 1)}
              className="flex size-6 items-center justify-center rounded-md border border-edge text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <Minus className="size-3" strokeWidth={2} />
            </button>
            <span className="min-w-[64px] text-center text-[11px] font-medium text-primary tabular-nums">
              {instance.startU === endU
                ? `U${instance.startU}`
                : `U${instance.startU}–U${endU}`}
            </span>
            <button
              type="button"
              aria-label="Move up one unit"
              onClick={() => tryMove(instance.startU + 1)}
              className="flex size-6 items-center justify-center rounded-md border border-edge text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <Plus className="size-3" strokeWidth={2} />
            </button>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[11px] leading-snug text-danger">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <span className="block text-xs text-secondary">Facing</span>
          <SegmentedControl
            label="Device facing"
            value={instance.facing}
            onChange={(facing) => setFacing(instance.id, facing)}
            options={FACING_OPTIONS}
          />
        </div>

        <div className="flex h-7 items-center justify-between">
          <span className="text-xs text-secondary">Visible</span>
          <Switch
            label="Device visible"
            checked={instance.visible}
            onChange={(visible) => setVisible(instance.id, visible)}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

function SpecsSection({ definition }: { definition: DeviceDefinition }) {
  return (
    <CollapsibleSection title="Specifications">
      <InfoRow label="Rack units">{definition.rackUnits}U</InfoRow>
      <InfoRow label="Width">{definition.widthMm} mm</InfoRow>
      <InfoRow label="Depth">{definition.depthMm} mm</InfoRow>
      <InfoRow label="Height">{definition.heightMm.toFixed(1)} mm</InfoRow>
      <InfoRow label="Weight">{definition.weightKg} kg</InfoRow>
      <InfoRow label="Power (typical)">
        {definition.powerConsumptionWatts} W
      </InfoRow>
      <InfoRow label="Power (max)">{definition.maximumPowerWatts} W</InfoRow>
      {definition.ports.length > 0 && (
        <InfoRow label="Ports">
          {definition.ports.reduce((sum, p) => sum + p.count, 0)}
        </InfoRow>
      )}
    </CollapsibleSection>
  );
}

interface DeviceInspectorProps {
  instance: PlacedDevice;
  definition: DeviceDefinition;
}

/** Inspector contents for a selected mounted device. */
export function DeviceInspector({
  instance,
  definition,
}: DeviceInspectorProps) {
  return (
    <>
      <ProductSection definition={definition} />
      {instance.surface ? (
        <ShelfPlacementSection instance={instance} definition={definition} />
      ) : (
        <PlacementSection instance={instance} definition={definition} />
      )}
      {definition.cableManagement && (
        <CableManagementSection instance={instance} definition={definition} />
      )}
      {definition.ports.length > 0 && (
        <EtherlightingDeviceSection definition={definition} />
      )}
      <ConnectionsSection instanceId={instance.id} />
      <HardwareSection definition={definition} />
      <SpecsSection definition={definition} />
      <AuthorPortsButton definitionId={definition.id} />
      <ResetToDefaultButton definitionId={definition.id} />
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => requestRemoveDevice(instance.id)}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          Remove from rack
        </button>
      </div>
    </>
  );
}

/**
 * Reverts a built-in device to its shipped definition, dropping a saved
 * "Author ports" copy kept in this browser. Only shown when such an
 * override exists for a built-in — the escape hatch when a stale saved
 * copy (e.g. old dimensions or a removed model) masks the current
 * catalog version.
 */
function ResetToDefaultButton({ definitionId }: { definitionId: string }) {
  const hasOverride = useAuthoredDevicesStore(
    (s) => s.definitions[definitionId] !== undefined,
  );
  const removeDefinition = useAuthoredDevicesStore((s) => s.removeDefinition);
  if (!hasOverride || !isBuiltinDevice(definitionId)) return null;

  const reset = () => {
    removeDefinition(definitionId);
    resetDeviceToBuiltin(definitionId);
    toast({ variant: 'success', title: 'Reset to catalog default' });
  };

  return (
    <div className="px-3 pt-1 pb-1">
      <button
        type="button"
        onClick={reset}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <RotateCcw className="size-3.5" strokeWidth={1.75} />
        Reset to catalog default
      </button>
    </div>
  );
}

/** Developer entry into the Device Authoring mode for this definition. */
function AuthorPortsButton({ definitionId }: { definitionId: string }) {
  const navigate = useNavigate();
  return (
    <div className="px-3 pt-3 pb-1">
      <button
        type="button"
        onClick={() => navigate(`/author?device=${definitionId}`)}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <PencilRuler className="size-3.5" strokeWidth={1.75} />
        Author ports…
      </button>
    </div>
  );
}
