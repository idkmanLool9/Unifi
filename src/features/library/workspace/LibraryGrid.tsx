import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  FolderInput,
  Layers,
  PackagePlus,
  Pin,
  Star,
  Wrench,
} from 'lucide-react';
import { deviceById } from '../catalog';
import { DeviceThumbnail } from '../DeviceThumbnail';
import { manufacturerInfo } from './manufacturers';
import { useLibraryMetaStore } from './libraryMetaStore';
import { useLibraryWorkspaceStore } from './libraryWorkspaceStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMenuStore, type MenuEntry } from '@/stores/menuStore';
import { usePricingStore } from '@/stores/pricingStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { toast } from '@/stores/toastStore';
import { formatMoney, priceForDevice } from '@/features/devices/pricing';
import { Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LibraryEntry } from './libraryIndex';

/**
 * The device grid — windowed by hand so 100k entries scroll at full
 * frame rate: only the rows intersecting the viewport (plus overscan)
 * exist in the DOM. Cards carry the full asset-management surface:
 * badges, favorite, pin, drag-to-collection and a context menu.
 */

const CARD_H = 336;
const CARD_MIN_W = 252;
const GAP = 16;
const OVERSCAN_ROWS = 2;

export function LibraryGrid({
  entries,
  onOpenAuthoring,
}: {
  entries: LibraryEntry[];
  onOpenAuthoring: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      setViewport({ width: host.clientWidth, height: host.clientHeight });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(
    1,
    Math.floor((viewport.width - GAP) / (CARD_MIN_W + GAP)),
  );
  const rowCount = Math.ceil(entries.length / columns);
  const totalHeight = rowCount * (CARD_H + GAP) + GAP;

  const firstRow = Math.max(
    0,
    Math.floor(scrollTop / (CARD_H + GAP)) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    rowCount - 1,
    Math.ceil((scrollTop + viewport.height) / (CARD_H + GAP)) + OVERSCAN_ROWS,
  );

  const visible = useMemo(() => {
    const out: Array<{ entry: LibraryEntry; index: number }> = [];
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index < entries.length) out.push({ entry: entries[index], index });
      }
    }
    return out;
  }, [entries, firstRow, lastRow, columns]);

  return (
    <div
      ref={hostRef}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      {entries.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
          <Layers className="size-8" strokeWidth={1.2} />
          <p className="text-sm">No devices match this view.</p>
          <p className="text-xs">Adjust the search, filters or category.</p>
        </div>
      ) : (
        <div className="relative" style={{ height: totalHeight }}>
          {visible.map(({ entry, index }) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const cellW = (viewport.width - GAP * (columns + 1)) / columns;
            return (
              <div
                key={entry.id}
                className="absolute"
                style={{
                  left: GAP + col * (cellW + GAP),
                  top: GAP + row * (CARD_H + GAP),
                  width: cellW,
                  height: CARD_H,
                }}
              >
                <LibraryCard entry={entry} onOpenAuthoring={onOpenAuthoring} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  entry,
  onOpenAuthoring,
}: {
  entry: LibraryEntry;
  onOpenAuthoring: (id: string) => void;
}) {
  const selected = useLibraryWorkspaceStore((s) => s.selectedId === entry.id);
  const select = useLibraryWorkspaceStore((s) => s.select);
  const favorite = useLibraryStore((s) => s.favoriteIds.includes(entry.id));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const markRecent = useLibraryStore((s) => s.selectDevice);
  const pinned = useLibraryMetaStore((s) => s.pinnedIds.includes(entry.id));
  const togglePinned = useLibraryMetaStore((s) => s.togglePinned);
  const collections = useLibraryMetaStore((s) => s.collections);
  const addToCollection = useLibraryMetaStore((s) => s.addToCollection);
  const openMenu = useMenuStore((s) => s.openMenu);

  const info = manufacturerInfo(
    entry.definition.manufacturer,
    entry.definition.manufacturerName,
  );
  const catalog = deviceById(entry.id);
  const currency = usePricingStore((s) => s.currency);
  const price = priceForDevice({ id: entry.definition.id });
  const addDevice = useDeviceInstancesStore((s) => s.addDevice);

  const addToRack = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = addDevice(entry.id);
    toast(
      result.ok
        ? {
            variant: 'success',
            title: `${entry.definition.productName} added to rack`,
          }
        : { variant: 'warning', title: result.message },
    );
  };

  const contextEntries = (): MenuEntry[] => [
    {
      id: 'authoring',
      label: 'Open in Device Authoring',
      icon: Wrench,
      action: () => onOpenAuthoring(entry.id),
    },
    {
      id: 'favorite',
      label: favorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      action: () => toggleFavorite(entry.id),
    },
    {
      id: 'pin',
      label: pinned ? 'Unpin' : 'Pin to quick access',
      icon: Pin,
      action: () => togglePinned(entry.id),
    },
    ...(collections.length
      ? ([{ separator: true }] as MenuEntry[])
      : []),
    ...collections.map((c) => ({
      id: `collection-${c.id}`,
      label: `Add to “${c.name}”`,
      icon: FolderInput,
      action: () => addToCollection(c.id, entry.id),
    })),
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-pressed={selected}
      onDragStart={(e) => {
        e.dataTransfer.setData('rackforge/device-id', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => {
        select(entry.id);
        markRecent(entry.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(entry.id);
          markRecent(entry.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        select(entry.id);
        openMenu(e.clientX, e.clientY, contextEntries());
      }}
      className={cn(
        'group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border text-left',
        'transition-[transform,border-color,box-shadow] duration-150 ease-out',
        selected
          ? 'border-accent/60 shadow-[0_0_0_1px_var(--color-accent)]'
          : 'border-edge bg-surface-raised hover:-translate-y-0.5 hover:border-edge-strong hover:shadow-panel',
      )}
    >
      {/* Product image well */}
      <div className="relative flex h-[150px] shrink-0 items-center justify-center bg-linear-to-b from-surface-raised to-surface px-6">
        {catalog && (
          <DeviceThumbnail
            device={catalog}
            className="max-h-[104px] w-full drop-shadow-md transition-transform duration-200 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1">
          {entry.verified && (
            <span
              title="Verified — authored and production ready"
              className="flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold text-success"
            >
              <BadgeCheck className="size-2.5" /> Verified
            </span>
          )}
          {!entry.verified && entry.authored && (
            <span
              title="Ports hand-authored"
              className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent"
            >
              Authored
            </span>
          )}
          {entry.meta.hidden && (
            <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
              Hidden
            </span>
          )}
        </div>
        <button
          type="button"
          title={favorite ? 'Unfavorite' : 'Favorite'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(entry.id);
          }}
          className={cn(
            'absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full transition-colors',
            favorite
              ? 'text-warning opacity-100'
              : 'text-muted opacity-0 hover:bg-surface-active group-hover:opacity-100',
          )}
        >
          <Star className="size-3.5" fill={favorite ? 'currentColor' : 'none'} />
        </button>
        {pinned && (
          <Pin
            className="absolute bottom-2.5 right-2.5 size-3.5 text-accent"
            fill="currentColor"
          />
        )}
        <span
          className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-md bg-surface-raised/85 px-1.5 py-0.5 text-[9.5px] font-semibold shadow-xs backdrop-blur-sm"
          style={{ color: info.accent }}
        >
          {info.monogram}
        </span>
      </div>

      {/* Identity + specs + action */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-edge px-3.5 pt-3 pb-3.5">
        <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-primary">
          {entry.definition.productName}
        </h3>
        <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted">
          {entry.definition.modelNumber}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-secondary">
          {entry.definition.description}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[9.5px] font-semibold text-secondary tabular-nums">
            {entry.definition.rackUnits}U
          </span>
          {entry.portCount > 0 && (
            <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[9.5px] font-semibold text-secondary tabular-nums">
              {entry.portCount} ports
            </span>
          )}
          {entry.poe && (
            <span className="flex items-center gap-0.5 rounded-md bg-surface-active px-1.5 py-0.5 text-[9.5px] font-semibold text-secondary">
              <Zap className="size-2.5" strokeWidth={2.5} />
              PoE
            </span>
          )}
          {!entry.ready && (
            <span
              title={entry.issues.map((i) => i.label).join('\n')}
              className="ml-auto flex items-center gap-1 rounded-md bg-warning/12 px-1.5 py-0.5 text-[9.5px] font-semibold text-warning"
            >
              <PackagePlus className="size-2.5" />
              {entry.issues.filter((i) => i.level !== 'info').length} to do
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-primary tabular-nums">
              {price === undefined ? '—' : formatMoney(price, currency)}
            </span>
            <span className="text-[10px] text-muted">estimated</span>
          </div>
          <button
            type="button"
            onClick={addToRack}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-[12px] font-semibold text-on-accent shadow-accent transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98]"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Add to rack
          </button>
        </div>
      </div>
    </div>
  );
}
