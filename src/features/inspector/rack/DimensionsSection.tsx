import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { maxOccupiedU, rackHeightFor } from '@/features/rack/rackMath';
import { useRackGeometry } from '@/features/rack/useRackGeometry';
import { RACK_SIZES } from '@/features/rack/rackConstants';
import { getProfile } from '@/features/rack/rackProfiles';
import { toast } from '@/stores/toastStore';
import { cn } from '@/lib/utils';
import type { RackConfig, RackSize } from '@/types';

export function DimensionsSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);
  const instances = useDeviceInstancesStore((s) => s.instances);

  const profile = getProfile(rack.profileId);
  const geometry = useRackGeometry(rack);

  const highestUsed = maxOccupiedU({
    rackUnits: rack.units,
    usableDepthMm: geometry.usableDepthM * 1000,
    shelfAvailable: profile.shelfCompatible,
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
            {RACK_SIZES.map((size) => {
              const allowed = profile.allowedUnits.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={rack.units === size}
                  disabled={!allowed}
                  title={
                    allowed ? undefined : `${profile.name} is not made in ${size}U`
                  }
                  onClick={() => setUnits(size)}
                  className={cn(
                    'h-6 rounded-[6px] text-[11px] font-medium tabular-nums transition-colors duration-100',
                    rack.units === size
                      ? 'bg-accent text-on-accent shadow-xs'
                      : 'text-muted hover:bg-surface-hover hover:text-primary',
                    !allowed && 'pointer-events-none opacity-30',
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
        <InfoRow label="Overall height">
          {rackHeightFor(rack.units, geometry).toFixed(2)} m
        </InfoRow>
        <InfoRow label="External width">
          {(geometry.externalWidthM * 1000).toFixed(0)} mm
        </InfoRow>
        <InfoRow label="External depth">
          {(geometry.externalDepthM * 1000).toFixed(0)} mm
        </InfoRow>
        <InfoRow label="Load rating">{profile.loadRatingKg} kg</InfoRow>
      </div>
    </CollapsibleSection>
  );
}
