import { useMemo, useState } from 'react';
import { Cable, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import {
  CABLE_CATALOG,
  CABLE_TYPES,
  type CableTypeId,
} from '@/features/cables/cableCatalog';
import { formatLength } from '@/features/cables/compatibility';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useCableStore } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  invalid: 'bg-danger',
};

/**
 * Project-level connection list: every cable in the scene with search
 * and type filtering. Selecting an entry selects the cable in the
 * editor and closes the dialog.
 */
export function ConnectionsDialog() {
  const open = useOverlayStore((s) => s.connectionsOpen);
  const setOpen = useOverlayStore((s) => s.setConnectionsOpen);
  const cables = useCableStore((s) => s.cables);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const selectCable = useSelectionStore((s) => s.selectCable);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CableTypeId | 'all'>('all');

  const deviceName = (deviceInstanceId: string): string => {
    const instance = instances.find((i) => i.id === deviceInstanceId);
    return (instance && getDevice(instance.definitionId)?.productName) ?? 'Device';
  };

  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return cables.filter((cable) => {
      if (typeFilter !== 'all' && cable.type !== typeFilter) return false;
      if (terms.length === 0) return true;
      const haystack = [
        deviceName(cable.source.deviceInstanceId),
        cable.source.portRef,
        deviceName(cable.destination.deviceInstanceId),
        cable.destination.portRef,
        CABLE_CATALOG[cable.type].name,
        cable.label ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, instances, query, typeFilter]);

  const warnings = cables.filter((c) => c.status !== 'ok').length;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} width={520}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Cable className="size-4 text-secondary" strokeWidth={1.75} />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Connections
          </h2>
          <span className="text-[11px] text-muted">
            {cables.length} cable{cables.length === 1 ? '' : 's'}
            {warnings > 0 ? ` · ${warnings} with warnings` : ''}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search devices, ports, labels…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-edge bg-surface-raised pr-2 pl-7 text-xs text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <select
            aria-label="Filter by cable type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CableTypeId | 'all')}
            className="h-8 rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
          >
            <option value="all">All types</option>
            {CABLE_TYPES.map((id) => (
              <option key={id} value={id}>
                {CABLE_CATALOG[id].name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 max-h-80 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              {cables.length === 0
                ? 'No cables yet — use the Cable Tool (C) to connect ports.'
                : 'No cables match the current filters.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((cable) => (
                <li key={cable.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selectCable(cable.id);
                      setOpen(false);
                    }}
                    className="w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-edge hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          STATUS_DOT[cable.status],
                        )}
                      />
                      <span
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: cable.color }}
                      />
                      <span className="truncate text-[11.5px] font-medium text-primary">
                        {deviceName(cable.source.deviceInstanceId)} ·{' '}
                        {cable.source.portRef} →{' '}
                        {deviceName(cable.destination.deviceInstanceId)} ·{' '}
                        {cable.destination.portRef}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate pl-[22px] text-[10px] text-muted">
                      {CABLE_CATALOG[cable.type].name} ·{' '}
                      {formatLength(cable.nominalLengthMm)}
                      {cable.label ? ` · ${cable.label}` : ''}
                      {cable.statusMessage ? ` · ${cable.statusMessage}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
