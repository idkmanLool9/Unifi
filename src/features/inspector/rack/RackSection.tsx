import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { getDevice } from '@/features/devices/deviceRegistry';
import {
  deepestDeviceDepthMm,
  maxOccupiedU,
  rackGeometryFor,
} from '@/features/rack/rackMath';
import {
  defaultRailSpacingMm,
  getProfile,
  RACK_PROFILES,
  type RackProfileId,
} from '@/features/rack/rackProfiles';
import { toast } from '@/stores/toastStore';
import type { RackConfig, RackSize } from '@/types';

const ENCLOSURE_LABELS = {
  'open-frame': 'Open frame',
  cabinet: 'Cabinet',
  'desktop-frame': 'Desktop frame',
  'wall-mount': 'Wall-mount',
} as const;

export function RackSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const profile = getProfile(rack.profileId);

  const switchProfile = (profileId: RackProfileId) => {
    const next = getProfile(profileId);
    const nextSpacing = defaultRailSpacingMm(next);
    const nextGeometry = rackGeometryFor(
      { profileId, railMode: rack.railMode, railSpacingMm: nextSpacing },
      deepestDeviceDepthMm(instances, getDevice),
    );
    const usableMm = nextGeometry.usableDepthM * 1000;

    // Devices must survive the switch: depth fit and unit range.
    const tooDeep = instances
      .map((i) => getDevice(i.definitionId))
      .find((d) => d && d.depthMm > usableMm);
    if (tooDeep) {
      toast({
        variant: 'warning',
        title: `Doesn't fit in ${next.name}`,
        description: `${tooDeep.productName} needs ${tooDeep.depthMm} mm of depth; this rack offers ${Math.round(usableMm)} mm.`,
      });
      return;
    }

    const units: RackSize = next.allowedUnits.includes(rack.units)
      ? rack.units
      : next.allowedUnits[next.allowedUnits.length - 1];
    const highestUsed = maxOccupiedU({
      rackUnits: rack.units,
      usableDepthMm: usableMm,
      shelfAvailable: next.shelfCompatible,
      instances,
      getDefinition: getDevice,
    });
    if (highestUsed > units) {
      toast({
        variant: 'warning',
        title: `Doesn't fit in ${next.name}`,
        description: `Devices occupy up to U${highestUsed}, but this rack is ${units}U.`,
      });
      return;
    }

    updateRack({ profileId, railSpacingMm: nextSpacing, units });
  };

  return (
    <CollapsibleSection title="Rack">
      <div className="space-y-2">
        <div className="space-y-1">
          <label htmlFor="rack-name" className="block text-xs text-secondary">
            Name
          </label>
          <input
            id="rack-name"
            type="text"
            value={rack.name}
            onChange={(e) => updateRack({ name: e.target.value })}
            className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary transition-colors focus:border-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="rack-profile"
            className="block text-xs text-secondary"
          >
            Profile
          </label>
          <select
            id="rack-profile"
            value={rack.profileId}
            onChange={(e) => switchProfile(e.target.value as RackProfileId)}
            className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary transition-colors focus:border-accent focus:outline-none"
          >
            {Object.values(RACK_PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="pt-0.5 text-[10.5px] leading-snug text-muted">
            {profile.description}
          </p>
        </div>

        <InfoRow label="Type">{ENCLOSURE_LABELS[profile.enclosure]}</InfoRow>
        <InfoRow label="Standard">EIA-310 · 19″</InfoRow>
        <InfoRow label="Status">
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            Draft
          </span>
        </InfoRow>
      </div>
    </CollapsibleSection>
  );
}
