import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { CABLE_CATALOG } from '@/features/cables/cableCatalog';
import { formatLength } from '@/features/cables/compatibility';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useCableStore, cablesForDevice } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  invalid: 'bg-danger',
};

/** All cables attached to the selected device; a click selects the cable. */
export function ConnectionsSection({ instanceId }: { instanceId: string }) {
  const cables = useCableStore((s) => s.cables);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const selectCable = useSelectionStore((s) => s.selectCable);

  const attached = cablesForDevice(cables, instanceId);
  if (attached.length === 0) return null;

  const remoteName = (deviceInstanceId: string): string => {
    const remote = instances.find((i) => i.id === deviceInstanceId);
    return (remote && getDevice(remote.definitionId)?.productName) ?? 'Device';
  };

  return (
    <CollapsibleSection title={`Connections (${attached.length})`}>
      <ul className="space-y-1">
        {attached.map((cable) => {
          const local =
            cable.source.deviceInstanceId === instanceId
              ? cable.source
              : cable.destination;
          const remote =
            cable.source.deviceInstanceId === instanceId
              ? cable.destination
              : cable.source;
          return (
            <li key={cable.id}>
              <button
                type="button"
                onClick={() => selectCable(cable.id)}
                className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-edge hover:bg-surface-hover"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      STATUS_DOT[cable.status],
                    )}
                  />
                  <span className="truncate text-[11px] font-medium text-primary">
                    {local.portRef} → {remoteName(remote.deviceInstanceId)}
                  </span>
                </div>
                <p className="mt-0.5 truncate pl-3 text-[10px] text-muted">
                  {remote.portRef} · {CABLE_CATALOG[cable.type].name} ·{' '}
                  {formatLength(cable.nominalLengthMm)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}
