import { motion } from 'framer-motion';
import { Heart, Zap } from 'lucide-react';
import { DeviceThumbnail } from './DeviceThumbnail';
import { brandById, CATEGORY_LABELS, type CatalogDevice } from './catalog';
import { useLibraryStore } from '@/stores/libraryStore';
import { cn } from '@/lib/utils';

function Chip({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[17px] items-center gap-0.5 rounded-[5px] px-1.5 text-[10px] font-semibold tabular-nums',
        accent ? 'bg-accent-soft text-accent' : 'bg-surface-active text-secondary',
      )}
    >
      {children}
    </span>
  );
}

interface DeviceCardProps {
  device: CatalogDevice;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const selected = useLibraryStore((s) => s.selectedDeviceId === device.id);
  const favorite = useLibraryStore((s) => s.favoriteIds.includes(device.id));
  const selectDevice = useLibraryStore((s) => s.selectDevice);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const brand = brandById(device.brandId);

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={() => selectDevice(selected ? null : device.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDevice(selected ? null : device.id);
        }
      }}
      aria-pressed={selected}
      className={cn(
        'group relative w-full cursor-pointer rounded-[10px] border p-2 text-left',
        'transition-colors duration-100',
        selected
          ? 'border-accent/60 bg-accent-soft/60'
          : 'border-transparent hover:border-edge hover:bg-surface-hover',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Thumbnail tile */}
        <div className="flex h-11 w-[76px] shrink-0 items-center rounded-lg border border-edge bg-surface-raised px-1.5 transition-transform duration-150 group-hover:scale-[1.03]">
          <DeviceThumbnail device={device} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-[12.5px] leading-tight font-medium text-primary">
              {device.name}
            </p>
            {device.badge && (
              <span
                className={cn(
                  'shrink-0 rounded-sm px-1 py-px text-[9px] font-bold tracking-wide uppercase',
                  device.badge === 'new'
                    ? 'bg-success/15 text-success'
                    : 'bg-accent-soft text-accent',
                )}
              >
                {device.badge}
              </span>
            )}
          </div>
          <p className="mt-px truncate text-[10.5px] leading-tight text-muted">
            {brand?.name} · {CATEGORY_LABELS[device.category]}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Chip accent>{device.units}U</Chip>
            {device.ports !== undefined && <Chip>{device.ports} ports</Chip>}
            {device.poe && (
              <Chip>
                <Zap className="size-2.5" strokeWidth={2.5} />
                PoE
              </Chip>
            )}
            <span className="ml-auto pr-0.5 text-[10px] text-muted tabular-nums">
              {device.weightKg} kg · {device.depthMm} mm
            </span>
          </div>
        </div>
      </div>

      {/* Favourite — revealed on hover, pinned when active */}
      <button
        type="button"
        aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={favorite}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(device.id);
        }}
        className={cn(
          'absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-md',
          'transition-all duration-100 hover:bg-surface-active',
          favorite
            ? 'text-danger opacity-100'
            : 'text-muted opacity-0 group-hover:opacity-100 hover:text-secondary',
        )}
      >
        <Heart
          className="size-3.5"
          strokeWidth={2}
          fill={favorite ? 'currentColor' : 'none'}
        />
      </button>
    </motion.div>
  );
}
