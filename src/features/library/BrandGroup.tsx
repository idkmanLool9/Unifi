import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, PackageOpen } from 'lucide-react';
import { DeviceCard } from './DeviceCard';
import {
  CATEGORY_LABELS,
  devicesByBrand,
  type CatalogBrand,
  type DeviceCategory,
} from './catalog';
import { useLibraryStore } from '@/stores/libraryStore';
import { cn } from '@/lib/utils';

export function BrandMonogram({
  brand,
  className,
}: {
  brand: CatalogBrand;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${brand.tint} 14%, transparent)`,
        color: brand.tint,
      }}
    >
      {brand.monogram}
    </span>
  );
}

/** Collapsible manufacturer group with category subsections. */
export function BrandGroup({ brand }: { brand: CatalogBrand }) {
  const expanded = useLibraryStore((s) => s.expandedBrands.includes(brand.id));
  const toggleBrand = useLibraryStore((s) => s.toggleBrand);

  const devices = useMemo(() => devicesByBrand(brand.id), [brand.id]);

  const categories = useMemo(() => {
    const seen = new Map<DeviceCategory, number>();
    for (const d of devices) seen.set(d.category, (seen.get(d.category) ?? 0) + 1);
    return [...seen.keys()];
  }, [devices]);

  return (
    <div
      className={cn(
        'rounded-[10px] transition-colors',
        expanded && 'bg-surface-raised/60 ring-1 ring-edge',
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => toggleBrand(brand.id)}
        className={cn(
          'flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-100',
          !expanded && 'hover:bg-surface-hover',
        )}
      >
        <BrandMonogram brand={brand} />
        <span className="flex-1 truncate text-[12.5px] font-semibold text-primary">
          {brand.name}
        </span>
        <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-semibold text-muted tabular-nums">
          {devices.length}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="flex text-muted"
        >
          <ChevronRight className="size-3.5" strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-1.5">
              {devices.length === 0 ? (
                <div className="mx-1 mb-1 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-edge-strong px-3 py-4 text-center">
                  <PackageOpen className="size-4 text-muted" strokeWidth={1.5} />
                  <p className="text-[11px] text-secondary">No devices yet</p>
                  <p className="text-[10px] leading-snug text-muted">
                    {brand.name} models are being catalogued
                  </p>
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category} className="pt-1">
                    <p className="px-1.5 pb-0.5 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
                      {CATEGORY_LABELS[category]}
                    </p>
                    <div className="space-y-0.5">
                      {devices
                        .filter((d) => d.category === category)
                        .map((device) => (
                          <DeviceCard key={device.id} device={device} />
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
