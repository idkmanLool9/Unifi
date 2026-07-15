import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useRackStore } from '@/stores/rackStore';
import type { RackConfig } from '@/types';

export function RackSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);

  return (
    <CollapsibleSection title="Rack">
      <div className="space-y-2">
        <div className="space-y-1">
          <label
            htmlFor="rack-name"
            className="block text-xs text-secondary"
          >
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
        <InfoRow label="Type">Open frame</InfoRow>
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
