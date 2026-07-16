import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { InfoRow } from '../InfoRow';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import { rackGeometry, type RailMode } from '@/features/rack/rackMath';
import { useRackGeometry } from '@/features/rack/useRackGeometry';
import { getProfile } from '@/features/rack/rackProfiles';
import { toast } from '@/stores/toastStore';
import type { RackConfig } from '@/types';

const RAIL_MODES: ReadonlyArray<{ value: RailMode; label: string }> = [
  { value: 'auto', label: 'Auto-fit' },
  { value: 'manual', label: 'Manual' },
];

/**
 * Rail configuration: the distinction between the enclosure and the
 * mounting planes. Adjustable-depth racks position their rear rails
 * automatically against the deepest installed device (like a real rack
 * build), or expose a manual rail-spacing control, guarded so mounted
 * devices always keep enough usable depth.
 */
export function RailsSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);
  const instances = useDeviceInstancesStore((s) => s.instances);

  const profile = getProfile(rack.profileId);
  const geometry = useRackGeometry(rack);
  const range = profile.railSpacingRange;

  const spacingMm = Math.round(geometry.railSpacingM * 1000);
  const frontInset = profile.frontRailInsetMm;
  const rearFromFront = frontInset + spacingMm;

  const deepestMounted = instances.reduce((max, i) => {
    const d = getDevice(i.definitionId);
    return d ? Math.max(max, d.depthMm) : max;
  }, 0);

  const setMode = (railMode: RailMode) => {
    // Entering manual keeps the rails where auto-fit left them.
    updateRack(
      railMode === 'manual'
        ? { railMode, railSpacingMm: spacingMm }
        : { railMode },
    );
  };

  const setSpacing = (nextMm: number) => {
    const usableMm = rackGeometry(rack.profileId, nextMm).usableDepthM * 1000;
    if (deepestMounted > usableMm) {
      toast({
        variant: 'warning',
        title: 'Rails would collide with a device',
        description: `The deepest mounted device needs ${deepestMounted} mm; this spacing offers ${Math.round(usableMm)} mm.`,
      });
      return;
    }
    updateRack({ railSpacingMm: nextMm });
  };

  return (
    <CollapsibleSection title="Rails">
      <div className="space-y-2">
        {range && (
          <div className="space-y-1">
            <span className="block text-xs text-secondary">
              Rail positioning
            </span>
            <SegmentedControl
              label="Rail positioning"
              value={rack.railMode}
              onChange={setMode}
              options={RAIL_MODES}
            />
            <p className="pt-0.5 text-[10.5px] leading-snug text-muted">
              {rack.railMode === 'auto'
                ? 'Rear rails follow the deepest installed device, like a real rack build.'
                : 'Rear rails stay at a fixed spacing you choose.'}
            </p>
          </div>
        )}

        <InfoRow label="Front rail">
          {frontInset === 0
            ? 'At front face'
            : `${frontInset} mm from front`}
        </InfoRow>
        <InfoRow label="Rear rail">
          {Math.round(rearFromFront)} mm from front
        </InfoRow>
        <InfoRow label="Rail spacing">
          {spacingMm} mm
          {range === null ? (
            <span className="ml-1.5 rounded-sm bg-surface-active px-1 py-px text-[9px] font-bold tracking-wide text-muted uppercase">
              Fixed
            </span>
          ) : (
            rack.railMode === 'auto' && (
              <span className="ml-1.5 rounded-sm bg-accent-soft px-1 py-px text-[9px] font-bold tracking-wide text-accent uppercase">
                Auto
              </span>
            )
          )}
        </InfoRow>
        <InfoRow label="Usable depth">
          {Math.round(geometry.usableDepthM * 1000)} mm
        </InfoRow>
        {deepestMounted > 0 && (
          <InfoRow label="Deepest device">{deepestMounted} mm</InfoRow>
        )}

        {range && rack.railMode === 'manual' && (
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
