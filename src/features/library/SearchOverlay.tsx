import { motion } from 'framer-motion';
import { Clock, Search, SearchX, TrendingUp } from 'lucide-react';
import { DeviceThumbnail } from './DeviceThumbnail';
import { brandById, deviceById } from './catalog';
import { useLibraryStore } from '@/stores/libraryStore';

/**
 * Visual design of the search experience — recent searches, suggestions
 * and popular devices. Query matching itself ships with the real catalog
 * in a later milestone, so a typed query presents the no-results design.
 */

const RECENT_SEARCHES = ['dream machine', '48 port poe', 'short depth nas'];

const SUGGESTIONS = [
  { label: 'PoE switches', detail: 'Category' },
  { label: 'Ubiquiti', detail: 'Manufacturer' },
  { label: '10G aggregation', detail: 'Popular filter' },
];

const POPULAR_IDS = ['ubnt-udm-pro', 'ubnt-usw-pro-48-poe', 'apc-smt1500rm'];

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: string;
}) {
  return (
    <p className="flex items-center gap-1.5 px-1 pb-1 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
      <Icon className="size-3" strokeWidth={2} />
      {children}
    </p>
  );
}

interface SearchOverlayProps {
  query: string;
  onClose: () => void;
}

export function SearchOverlay({ query, onClose }: SearchOverlayProps) {
  const selectDevice = useLibraryStore((s) => s.selectDevice);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-x-3 top-[92px] z-30 rounded-xl border border-edge bg-surface p-2 shadow-overlay"
    >
      {query.length > 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <div className="flex size-9 items-center justify-center rounded-lg border border-edge bg-surface-raised">
            <SearchX className="size-4 text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-medium text-primary">
            No results for “{query}”
          </p>
          <p className="text-[11px] leading-relaxed text-secondary">
            Catalog search arrives with the full device database. Try
            browsing by manufacturer below.
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-1">
          <div>
            <SectionLabel icon={Clock}>Recent</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {RECENT_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="flex items-center gap-1 rounded-md bg-surface-active px-2 py-1 text-[11px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
                >
                  <Search className="size-2.5" strokeWidth={2} />
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel icon={Search}>Suggestions</SectionLabel>
            <div className="space-y-px">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="text-xs text-primary">{s.label}</span>
                  <span className="text-[10px] text-muted">{s.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel icon={TrendingUp}>Popular devices</SectionLabel>
            <div className="space-y-px">
              {POPULAR_IDS.map((id) => {
                const device = deviceById(id);
                if (!device) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      selectDevice(id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex h-7 w-12 shrink-0 items-center rounded-md border border-edge bg-surface-raised px-1">
                      <DeviceThumbnail device={device} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-primary">
                        {device.name}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {brandById(device.brandId)?.name} · {device.units}U
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
