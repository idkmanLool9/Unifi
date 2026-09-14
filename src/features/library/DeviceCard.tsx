import { motion } from 'framer-motion';
import { Eye, Heart, Plus, Zap } from 'lucide-react';
import { DeviceThumbnail } from './DeviceThumbnail';
import { brandById, CATEGORY_LABELS, type CatalogDevice } from './catalog';
import { addDeviceToRack } from '@/features/devices/addDeviceAction';
import { armDrag } from '@/features/dragdrop/DragController';
import { shouldSuppressClick } from '@/stores/dragStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMenuStore } from '@/stores/menuStore';
import { useRackStore } from '@/stores/rackStore';
import { usePricingStore } from '@/stores/pricingStore';
import { formatMoney, priceForDevice } from '@/features/devices/pricing';
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
  const currency = usePricingStore((s) => s.currency);
  const price = priceForDevice({ id: device.id });

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={() => {
        // The click that ends a drag gesture must not toggle the preview.
        if (shouldSuppressClick()) return;
        selectDevice(selected ? null : device.id);
      }}
      onPointerDown={(e) =>
        // Real drag source: begins only past a movement threshold, so
        // plain clicks (and library scrolling) behave exactly as before.
        armDrag(e, () =>
          useRackStore.getState().rack
            ? { kind: 'library', definitionId: device.id }
            : null,
        )
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDevice(selected ? null : device.id);
        }
      }}
      aria-pressed={selected}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useMenuStore.getState().openMenu(e.clientX, e.clientY, [
          {
            id: 'preview',
            label: selected ? 'Close preview' : 'Preview device',
            icon: Eye,
            action: () => selectDevice(selected ? null : device.id),
          },
          {
            id: 'favorite',
            label: favorite ? 'Remove from favourites' : 'Add to favourites',
            icon: Heart,
            action: () => toggleFavorite(device.id),
          },
          { separator: true },
          {
            id: 'add',
            label: 'Add to rack',
            icon: Plus,
            disabled: useRackStore.getState().rack === null,
            action: () => addDeviceToRack(device.id),
          },
        ]);
      }}
      className={cn(
        'group relative w-full cursor-pointer rounded-lg border p-2 text-left',
        'transition-[background-color,border-color] duration-100 ease-out',
        selected
          ? 'border-accent/50 bg-accent-soft'
          : 'border-transparent hover:bg-surface-hover',
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Thumbnail tile */}
        <div className="relative flex h-11 w-[74px] shrink-0 items-center rounded-lg border border-edge bg-background px-1.5 transition-transform duration-150 ease-out group-hover:scale-[1.03]">
          <DeviceThumbnail device={device} />
          {device.badge && (
            <span
              className={cn(
                'absolute -top-1 -left-1 rounded-[4px] px-1 py-px text-[8.5px] font-bold tracking-wide uppercase shadow-xs',
                device.badge === 'new'
                  ? 'bg-success text-white'
                  : 'bg-accent text-on-accent',
              )}
            >
              {device.badge}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <p className="truncate text-[12.5px] leading-tight font-medium text-primary">
              {device.name}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-primary tabular-nums">
              {price === undefined ? '—' : formatMoney(price, currency)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10.5px] leading-tight text-muted">
            {brand?.name} · {CATEGORY_LABELS[device.category]}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Chip accent>{device.units}U</Chip>
            {device.ports !== undefined && <Chip>{device.ports}</Chip>}
            {device.poe && (
              <Chip>
                <Zap className="size-2.5" strokeWidth={2.5} />
                PoE
              </Chip>
            )}
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
