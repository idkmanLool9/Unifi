import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { maxOccupiedU } from '@/features/rack/rackMath';
import {
  RACK_SIZES,
  rackHeight,
  rackOuterDepth,
  rackOuterWidth,
} from '@/features/rack/rackConstants';
import { toast } from '@/stores/toastStore';
import { cn } from '@/lib/utils';
import type { RackConfig, RackSize } from '@/types';

export function DimensionsSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);
  const instances = useDeviceInstancesStore((s) => s.instances);

  const highestUsed = maxOccupiedU({
    rackUnits: rack.units,
    instances,
    getDefinition: getDevice,
  });

  const setUnits = (units: RackSize) => {
    if (units < highestUsed) {
      toast({
        variant: 'warning',
        title: 'Rack too short for mounted devices',
        description: `Devices occupy up to U${highestUsed}. Move or remove them before shrinking the rack.`,
      });
      return;
    }
    updateRack({ units });
  };

  return (
    <CollapsibleSection title="Dimensions">
      <div className="space-y-2">
        <div className="space-y-1">
          <span className="block text-xs text-secondary">Height</span>
          <div className="grid grid-cols-6 gap-0.5 rounded-lg border border-edge bg-background/40 p-0.5">
            {RACK_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={rack.units === size}
                onClick={() => setUnits(size)}
                className={cn(
                  'h-6 rounded-[6px] text-[11px] font-medium tabular-nums transition-colors duration-100',
                  rack.units === size
                    ? 'bg-accent text-on-accent shadow-xs'
                    : 'text-muted hover:bg-surface-hover hover:text-primary',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <InfoRow label="Overall height">
          {rackHeight(rack.units).toFixed(2)} m
        </InfoRow>
        <InfoRow label="Width">
          {rackOuterWidth().toFixed(2)} m
        </InfoRow>
        <InfoRow label="Depth">
          {rackOuterDepth().toFixed(2)} m
        </InfoRow>
        <InfoRow label="Load rating">350 kg</InfoRow>
      </div>
    </CollapsibleSection>
  );
}
