import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Heart, SlidersHorizontal } from 'lucide-react';
import { BrandGroup } from './BrandGroup';
import { DeviceCard } from './DeviceCard';
import { SkeletonCard } from './SkeletonCard';
import { SearchOverlay } from './SearchOverlay';
import { FilterPopover } from './FilterPopover';
import {
  catalogBrands,
  catalogDevices,
  deviceById,
  type CatalogDevice,
} from './catalog';
import { useRegistryStore } from '@/features/devices/deviceRegistry';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useLibraryStore, type LibraryTab } from '@/stores/libraryStore';
import type { LucideIcon } from 'lucide-react';

const TAB_OPTIONS: ReadonlyArray<{ value: LibraryTab; label: string }> = [
  { value: 'browse', label: 'Browse' },
  { value: 'favorites', label: 'Favourites' },
  { value: 'recent', label: 'Recent' },
];

/** Brief simulated fetch on first mount to exercise the loading design. */
const INITIAL_LOAD_MS = 650;

function ListEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl border border-edge bg-surface-raised">
        <Icon className="size-4.5 text-muted" strokeWidth={1.5} />
      </div>
      <p className="text-xs font-medium text-primary">{title}</p>
      <p className="text-[11px] leading-relaxed text-secondary">{description}</p>
    </div>
  );
}

function DeviceList({ devices }: { devices: CatalogDevice[] }) {
  return (
    <div className="space-y-0.5">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}

/** The device library: search, filters, tabs and the manufacturer tree. */
export function LibraryPanel() {
  const activeTab = useLibraryStore((s) => s.activeTab);
  const setActiveTab = useLibraryStore((s) => s.setActiveTab);
  const favoriteIds = useLibraryStore((s) => s.favoriteIds);
  const recentIds = useLibraryStore((s) => s.recentIds);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Re-derive the catalog when external definitions finish loading.
  useRegistryStore((s) => s.version);
  const brands = catalogBrands();
  const devices = catalogDevices();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), INITIAL_LOAD_MS);
    return () => clearTimeout(t);
  }, []);

  const favorites = favoriteIds
    .map(deviceById)
    .filter((d): d is CatalogDevice => d !== undefined);
  const recents = recentIds
    .map(deviceById)
    .filter((d): d is CatalogDevice => d !== undefined);

  return (
    <div className="relative flex h-full flex-col">
      <PanelHeader title="Library">
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-semibold text-muted tabular-nums">
            {devices.length}
          </span>
          <Tooltip label="Filters">
            <IconButton
              label="Filters"
              size="sm"
              active={filtersOpen}
              onClick={() => {
                setFiltersOpen((v) => !v);
                setSearchOpen(false);
              }}
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
            </IconButton>
          </Tooltip>
        </div>
      </PanelHeader>

      <div className="space-y-2 px-3 pt-3 pb-2">
        <SearchInput
          ref={searchRef}
          id="library-search"
          placeholder="Search devices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setSearchOpen(true);
            setFiltersOpen(false);
          }}
          onBlur={() => setSearchOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              setSearchOpen(false);
              e.currentTarget.blur();
            }
          }}
        />
        <SegmentedControl
          label="Library view"
          value={activeTab}
          onChange={setActiveTab}
          options={TAB_OPTIONS}
        />
      </div>

      {/* Floating overlays (anchored below the controls). Separate
          presence scopes so one overlay's exit never gates the other. */}
      <AnimatePresence>
        {searchOpen && (
          <SearchOverlay query={query} onClose={() => setSearchOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {filtersOpen && <FilterPopover onClose={() => setFiltersOpen(false)} />}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-1 pb-3">
        {loading ? (
          <div className="space-y-1 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          /* Keyed remount: entrance-only animation avoids exit stalls from
             nested AnimatePresence trees inside the tab content. */
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
              {activeTab === 'browse' && (
                <div className="space-y-1">
                  {brands.map((brand) => (
                    <BrandGroup key={brand.id} brand={brand} />
                  ))}
                </div>
              )}

              {activeTab === 'favorites' &&
                (favorites.length > 0 ? (
                  <DeviceList devices={favorites} />
                ) : (
                  <ListEmptyState
                    icon={Heart}
                    title="No favourites yet"
                    description="Hover any device card and tap the heart to pin it here for quick access."
                  />
                ))}

              {activeTab === 'recent' &&
                (recents.length > 0 ? (
                  <DeviceList devices={recents} />
                ) : (
                  <ListEmptyState
                    icon={Clock}
                    title="Nothing viewed yet"
                    description="Devices you preview will appear here, newest first."
                  />
                ))}
          </motion.div>
        )}
      </div>

      <div className="border-t border-edge px-4 py-2.5">
        <p className="text-[11px] text-muted">
          {brands.length} manufacturers · {devices.length} devices
        </p>
      </div>
    </div>
  );
}
