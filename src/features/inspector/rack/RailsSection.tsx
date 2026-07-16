import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { InfoRow } from '../InfoRow';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { rackGeometry } from '@/features/rack/rackMath';
import { getProfile } from '@/features/rack/rackProfiles';
import { toast } from '@/stores/toastStore';
import type { RackConfig } from '@/types';

/**
 * Rail configuration: the distinction between the enclosure and the
 * mounting planes. Adjustable-depth racks expose a rail-spacing control,
 * guarded so mounted devices always keep enough usable depth.
 */
export function RailsSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);
  const instances = useDeviceInstancesStore((s) => s.instances);

  const profile = getProfile(rack.profileId);
  const geometry = rackGeometry(rack.profileId, rack.railSpacingMm);
  const range = profile.railSpacingRange;

  const frontInset = profile.frontRailInsetMm;
  const rearFromFront = frontInset + geometry.railSpacingM * 1000;

  const deepestMounted = instances.reduce((max, i) => {
    const d = getDevice(i.definitionId);
    return d ? Math.max(max, d.depthMm) : max;
  }, 0);

  const setSpacing = (spacingMm: number) => {
    const usableMm = rackGeometry(rack.profileId, spacingMm).usableDepthM * 1000;
    if (deepestMounted > usableMm) {
      toast({
        variant: 'warning',
        title: 'Rails would collide with a device',
        description: `The deepest mounted device needs ${deepestMounted} mm; this spacing offers ${Math.round(usableMm)} mm.`,
      });
      return;
    }
    updateRack({ railSpacingMm: spacingMm });
  };

  return (
    <CollapsibleSection title="Rails">
      <div className="space-y-2">
        <InfoRow label="Front rail">
          {frontInset === 0
            ? 'At front face'
            : `${frontInset} mm from front`}
        </InfoRow>
        <InfoRow label="Rear rail">
          {Math.round(rearFromFront)} mm from front
        </InfoRow>
        <InfoRow label="Rail spacing">
          {Math.round(geometry.railSpacingM * 1000)} mm
          {range === null && (
            <span className="ml-1.5 rounded-sm bg-surface-active px-1 py-px text-[9px] font-bold tracking-wide text-muted uppercase">
              Fixed
            </span>
          )}
        </InfoRow>
        <InfoRow label="Usable depth">
          {Math.round(geometry.usableDepthM * 1000)} mm
        </InfoRow>
        {deepestMounted > 0 && (
          <InfoRow label="Deepest device">{deepestMounted} mm</InfoRow>
        )}

        {range && (
          <div className="pt-1">
            <Slider
              label="Rail spacing"
              value={rack.railSpacingMm}
              min={range.minMm}
              max={range.maxMm}
              step={10}
              onChange={setSpacing}
              format={(v) => `${v} mm`}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
