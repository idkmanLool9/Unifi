import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FilterX } from 'lucide-react';
import { activeFilterCount, type LibrarySort } from './libraryIndex';
import { useLibraryEntries } from './useLibraryEntries';
import { useLibraryWorkspaceStore } from './libraryWorkspaceStore';
import { manufacturerInfo } from './manufacturers';
import { cn } from '@/lib/utils';
import type { PhysicalConnectorType } from '@/features/devices/hardware/physicalPorts';

/**
 * Combinable filter chips over the compiled library. Every chip is a
 * dropdown editing one facet of the filter set; active chips highlight
 * and the whole set clears with one click.
 */

const PORT_TYPE_CHOICES: PhysicalConnectorType[] = [
  'rj45',
  'sfp+',
  'sfp28',
  'qsfp+',
  'keystone',
  'usb-c',
  'hdmi',
  'c14',
];

function Chip({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-6.5 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
          active
            ? 'border-accent/50 bg-accent/12 text-accent'
            : 'border-edge text-secondary hover:bg-raised',
        )}
      >
        {label}
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 min-w-[180px] rounded-xl border border-edge bg-surface-overlay p-2 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-6.5 w-full items-center gap-2 rounded-md px-1.5 text-left text-[11px] text-secondary transition-colors hover:bg-raised"
    >
      <span
        className={cn(
          'flex size-3.5 items-center justify-center rounded border',
          checked ? 'border-accent bg-accent text-white' : 'border-edge',
        )}
      >
        {checked && '✓'}
      </span>
      {children}
    </button>
  );
}

function TriToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === undefined ? true : undefined)}
      className={cn(
        'flex h-6.5 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        value !== undefined
          ? 'border-accent/50 bg-accent/12 text-accent'
          : 'border-edge text-secondary hover:bg-raised',
      )}
    >
      {label}
    </button>
  );
}

const SORT_LABELS: Record<LibrarySort, string> = {
  manufacturer: 'Manufacturer',
  name: 'Name',
  units: 'Rack units',
  ports: 'Port count',
  recent: 'Recently used',
};

export function LibraryFilterBar({ resultCount }: { resultCount: number }) {
  const entries = useLibraryEntries();
  const filters = useLibraryWorkspaceStore((s) => s.filters);
  const patchFilters = useLibraryWorkspaceStore((s) => s.patchFilters);
  const clearFilters = useLibraryWorkspaceStore((s) => s.clearFilters);
  const sort = useLibraryWorkspaceStore((s) => s.sort);
  const setSort = useLibraryWorkspaceStore((s) => s.setSort);

  const manufacturers = [
    ...new Set(entries.map((e) => e.definition.manufacturer)),
  ].map((id) => {
    const first = entries.find((e) => e.definition.manufacturer === id)!;
    return manufacturerInfo(id, first.definition.manufacturerName);
  });
  const unitChoices = [...new Set(entries.map((e) => e.definition.rackUnits))].sort(
    (a, b) => a - b,
  );

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const active = activeFilterCount(filters);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-edge bg-surface px-3 py-2">
      <Chip label="Manufacturer" active={filters.manufacturers.length > 0}>
        {manufacturers.map((m) => (
          <CheckRow
            key={m.id}
            checked={filters.manufacturers.includes(m.id)}
            onToggle={() =>
              patchFilters({
                manufacturers: toggleIn(filters.manufacturers, m.id),
              })
            }
          >
            <span
              className="flex size-4 items-center justify-center rounded text-[8px] font-bold"
              style={{ backgroundColor: `${m.accent}26`, color: m.accent }}
            >
              {m.monogram}
            </span>
            {m.name}
          </CheckRow>
        ))}
      </Chip>

      <Chip label="Rack units" active={filters.rackUnits.length > 0}>
        {unitChoices.map((u) => (
          <CheckRow
            key={u}
            checked={filters.rackUnits.includes(u)}
            onToggle={() =>
              patchFilters({ rackUnits: toggleIn(filters.rackUnits, u) })
            }
          >
            {u}U
          </CheckRow>
        ))}
      </Chip>

      <Chip label="Ports" active={filters.portTypes.length > 0 || filters.minPorts !== undefined}>
        <div className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Port types
        </div>
        {PORT_TYPE_CHOICES.map((t) => (
          <CheckRow
            key={t}
            checked={filters.portTypes.includes(t)}
            onToggle={() =>
              patchFilters({ portTypes: toggleIn(filters.portTypes, t) })
            }
          >
            {t.toUpperCase()}
          </CheckRow>
        ))}
        <div className="mt-1.5 flex items-center gap-1.5 px-1.5">
          <span className="text-[11px] text-secondary">Min count</span>
          <input
            type="number"
            min={0}
            aria-label="Minimum port count"
            value={filters.minPorts ?? ''}
            onChange={(e) =>
              patchFilters({
                minPorts:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="h-6 w-14 rounded border border-edge bg-surface-raised px-1.5 text-[11px] text-primary focus:border-accent focus:outline-none"
          />
        </div>
      </Chip>

      <Chip
        label="Depth"
        active={
          filters.depthMm !== undefined &&
          (filters.depthMm[0] !== null || filters.depthMm[1] !== null)
        }
      >
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          {(['min', 'max'] as const).map((bound, i) => (
            <input
              key={bound}
              type="number"
              aria-label={`Depth ${bound} (mm)`}
              placeholder={bound === 'min' ? 'Min mm' : 'Max mm'}
              value={filters.depthMm?.[i] ?? ''}
              onChange={(e) => {
                const value =
                  e.target.value === '' ? null : Number(e.target.value);
                const next: [number | null, number | null] = [
                  i === 0 ? value : (filters.depthMm?.[0] ?? null),
                  i === 1 ? value : (filters.depthMm?.[1] ?? null),
                ];
                patchFilters({
                  depthMm: next[0] === null && next[1] === null ? undefined : next,
                });
              }}
              className="h-6 w-20 rounded border border-edge bg-surface-raised px-1.5 text-[11px] text-primary focus:border-accent focus:outline-none"
            />
          ))}
        </div>
      </Chip>

      <TriToggle
        label="PoE"
        value={filters.poe}
        onChange={(poe) => patchFilters({ poe })}
      />
      <TriToggle
        label="Etherlighting"
        value={filters.etherlighting}
        onChange={(etherlighting) => patchFilters({ etherlighting })}
      />
      <TriToggle
        label="Authored"
        value={filters.authored}
        onChange={(authored) => patchFilters({ authored })}
      />
      <TriToggle
        label="Verified"
        value={filters.verified}
        onChange={(verified) => patchFilters({ verified })}
      />

      {active > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex h-6.5 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-muted transition-colors hover:bg-raised hover:text-primary"
        >
          <FilterX className="size-3" />
          Clear ({active})
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] tabular-nums text-muted">
          {resultCount} device{resultCount === 1 ? '' : 's'}
        </span>
        <label htmlFor="library-sort" className="text-[11px] text-muted">
          Sort
        </label>
        <select
          id="library-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as LibrarySort)}
          className="h-6.5 rounded-lg border border-edge bg-surface-raised px-1.5 text-[11px] font-medium text-primary focus:border-accent focus:outline-none"
        >
          {(Object.keys(SORT_LABELS) as LibrarySort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
