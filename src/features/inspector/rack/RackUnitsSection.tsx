import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import type { RackConfig } from '@/types';

export function RackUnitsSection({ rack }: { rack: RackConfig }) {
  const occupied = 0; // device placement arrives in a later milestone
  const percent = Math.round((occupied / rack.units) * 100);

  return (
    <CollapsibleSection title="Rack Units">
      <div className="space-y-2">
        <InfoRow label="Total">{rack.units}U</InfoRow>
        <InfoRow label="Occupied">{occupied}U</InfoRow>
        <InfoRow label="Available">{rack.units - occupied}U</InfoRow>
        <div className="space-y-1 pt-0.5">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Rack occupancy"
            className="h-1.5 overflow-hidden rounded-full bg-surface-active"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted">{percent}% occupied</p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
