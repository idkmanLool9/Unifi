import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Plus, X, Zap } from 'lucide-react';
import { DeviceThumbnail } from './DeviceThumbnail';
import { BrandMonogram } from './BrandGroup';
import { brandById, CATEGORY_LABELS, deviceById } from './catalog';
import { addDeviceToRack } from '@/features/devices/addDeviceAction';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconButton } from '@/components/ui/IconButton';
import { useLibraryStore } from '@/stores/libraryStore';
import { useRackStore } from '@/stores/rackStore';
import { cn } from '@/lib/utils';

function SpecTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-raised/70 px-2.5 py-2">
      <p className="text-[9.5px] font-semibold tracking-[0.06em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-primary tabular-nums">
        {value}
      </p>
    </div>
  );
}

/**
 * Floating device preview: opens beside the library when a device card is
 * selected. Premium product-page presentation with placeholder specs.
 */
export function DevicePreviewPanel() {
  const selectedId = useLibraryStore((s) => s.selectedDeviceId);
  const selectDevice = useLibraryStore((s) => s.selectDevice);
  const favorite = useLibraryStore(
    (s) => selectedId !== null && s.favoriteIds.includes(selectedId),
  );
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const device = selectedId ? deviceById(selectedId) : undefined;
  const brand = device ? brandById(device.brandId) : undefined;
  const hasRack = useRackStore((s) => s.rack !== null);

  return (
    <AnimatePresence>
      {device && brand && (
        <motion.aside
          key={device.id}
          initial={{ opacity: 0, x: -12, scale: 0.99 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.99 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="glass-panel absolute top-3 left-3 z-20 flex max-h-[calc(100%-24px)] w-[324px] flex-col overflow-hidden rounded-2xl shadow-overlay"
          aria-label="Device preview"
        >
          {/* Hero */}
          <div className="relative shrink-0 border-b border-edge bg-linear-to-b from-surface-raised/80 to-surface/40 px-5 pt-5 pb-4">
            <div className="absolute top-2.5 right-2.5">
              <IconButton
                label="Close preview"
                size="sm"
                onClick={() => selectDevice(null)}
              >
                <X className="size-3.5" strokeWidth={2} />
              </IconButton>
            </div>

            <div className="flex items-center rounded-xl border border-edge bg-surface-raised px-4 py-5 shadow-xs">
              <DeviceThumbnail device={device} />
            </div>

            <div className="mt-3.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <BrandMonogram brand={brand} className="size-5 text-[9px]" />
                  <p className="text-[11px] font-medium text-secondary">
                    {brand.name} · {CATEGORY_LABELS[device.category]}
                  </p>
                </div>
                <h2 className="mt-1 truncate text-[15px] leading-tight font-semibold tracking-tight text-primary">
                  {device.name}
                </h2>
              </div>
              {device.badge && (
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase',
                    device.badge === 'new'
                      ? 'bg-success/15 text-success'
                      : 'bg-accent-soft text-accent',
                  )}
                >
                  {device.badge}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-xs leading-relaxed text-secondary">
              {device.description}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-1.5">
              <SpecTile label="Rack units" value={`${device.units}U`} />
              <SpecTile label="Depth" value={`${device.depthMm} mm`} />
              <SpecTile label="Weight" value={`${device.weightKg} kg`} />
              <SpecTile
                label="Power"
                value={device.powerW > 0 ? `${device.powerW} W max` : '—'}
              />
              <SpecTile label="Ports" value={device.ports ?? '—'} />
              <SpecTile label="Speed" value={device.speed ?? '—'} />
            </div>

            {device.poe && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
                <Zap className="size-3.5 shrink-0 text-accent" strokeWidth={2} />
                <p className="text-[11px] leading-snug text-accent">
                  PoE capable — budget and per-port draw appear here once
                  power planning ships.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 border-t border-edge px-4 py-3">
            <Tooltip
              label={
                hasRack ? 'Mount in the first free slot' : 'Create a rack first'
              }
              side="top"
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={!hasRack}
                onClick={() => addDeviceToRack(device.id)}
                className="flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-xs font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Add to Rack
              </motion.button>
            </Tooltip>
            <button
              type="button"
              aria-pressed={favorite}
              onClick={() => toggleFavorite(device.id)}
              className={cn(
                'flex size-8 items-center justify-center rounded-[9px] border border-edge transition-colors',
                favorite
                  ? 'text-danger'
                  : 'text-muted hover:bg-surface-hover hover:text-secondary',
              )}
              aria-label={
                favorite ? 'Remove from favourites' : 'Add to favourites'
              }
            >
              <Heart
                className="size-3.5"
                strokeWidth={2}
                fill={favorite ? 'currentColor' : 'none'}
              />
            </button>
            <p className="ml-auto text-[9.5px] text-muted">
              {device.units}U · {device.depthMm} mm
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
