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
import { cn } from '@/lib/utils';
import type { LibraryEntry } from './libraryIndex';

/**
 * The device grid — windowed by hand so 100k entries scroll at full
 * frame rate: only the rows intersecting the viewport (plus overscan)
 * exist in the DOM. Cards carry the full asset-management surface:
 * badges, favorite, pin, drag-to-collection and a context menu.
 */

const CARD_H = 208;
const CARD_MIN_W = 224;
const GAP = 12;
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
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('rackforge/device-id', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => {
        select(entry.id);
        markRecent(entry.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        select(entry.id);
        openMenu(e.clientX, e.clientY, contextEntries());
      }}
      className={cn(
        'group flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition-all duration-150',
        selected
          ? 'border-accent/60 bg-accent/6 shadow-[0_0_0_1px_var(--color-accent)]'
          : 'border-edge bg-surface hover:-translate-y-0.5 hover:border-edge-strong hover:shadow-lg',
      )}
    >
      {/* Thumbnail well */}
      <div className="relative flex h-[104px] shrink-0 items-center justify-center bg-raised/60 px-5">
        {catalog && (
          <DeviceThumbnail
            device={catalog}
            className="max-h-[76px] drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute left-2 top-2 flex gap-1">
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
        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {pinned && <Pin className="size-3.5 text-accent" fill="currentColor" />}
          <span
            role="button"
            tabIndex={-1}
            title={favorite ? 'Unfavorite' : 'Favorite'}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(entry.id);
            }}
            onKeyDown={() => {}}
            className={cn(
              'rounded-md p-1 transition-colors hover:bg-raised',
              favorite ? 'text-warning opacity-100' : 'text-muted',
            )}
          >
            <Star className="size-3.5" fill={favorite ? 'currentColor' : 'none'} />
          </span>
        </div>
        {favorite && (
          <Star className="absolute right-2.5 top-2.5 size-3.5 text-warning group-hover:opacity-0" fill="currentColor" />
        )}
      </div>

      {/* Identity */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2.5">
        <div className="truncate text-[12.5px] font-semibold text-primary">
          {entry.definition.productName}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded text-[8px] font-bold"
            style={{ backgroundColor: `${info.accent}26`, color: info.accent }}
          >
            {info.monogram}
          </span>
          <span className="truncate text-[11px] text-secondary">{info.name}</span>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <span className="rounded bg-raised px-1.5 py-0.5 text-[9.5px] font-medium text-secondary">
            {entry.definition.rackUnits}U
          </span>
          {entry.portCount > 0 && (
            <span className="rounded bg-raised px-1.5 py-0.5 text-[9.5px] font-medium text-secondary">
              {entry.portCount} ports
            </span>
          )}
          {entry.poe && (
            <span className="rounded bg-raised px-1.5 py-0.5 text-[9.5px] font-medium text-secondary">
              PoE
            </span>
          )}
          {!entry.ready && (
            <span
              title={entry.issues.map((i) => i.label).join('\n')}
              className="ml-auto flex items-center gap-1 rounded bg-warning/12 px-1.5 py-0.5 text-[9.5px] font-medium text-warning"
            >
              <PackagePlus className="size-2.5" />
              {entry.issues.filter((i) => i.level !== 'info').length} to do
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
