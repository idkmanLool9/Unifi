import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tooltip } from '@/components/ui/Tooltip';
import { useRackStore } from '@/stores/rackStore';
import { RACK_FINISHES } from '@/features/rack/rackConstants';
import { cn } from '@/lib/utils';
import type { RackConfig, RackOrientation } from '@/types';

const ORIENTATIONS: ReadonlyArray<{
  value: RackOrientation;
  label: string;
}> = [
  { value: 'front', label: 'Front' },
  { value: 'rear', label: 'Rear' },
];

export function AppearanceSection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);

  return (
    <CollapsibleSection title="Appearance">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="block text-xs text-secondary">Finish</span>
          <div className="flex items-center gap-2">
            {Object.values(RACK_FINISHES).map((finish) => {
              const active = rack.finish === finish.id;
              return (
                <Tooltip key={finish.id} label={finish.label}>
                  <button
                    type="button"
                    aria-label={`Finish: ${finish.label}`}
                    aria-pressed={active}
                    onClick={() => updateRack({ finish: finish.id })}
                    className={cn(
                      'size-7 rounded-full border border-edge-strong shadow-xs transition-all duration-100',
                      active &&
                        'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                    )}
                    style={{ backgroundColor: finish.swatch }}
                  />
                </Tooltip>
              );
            })}
            <span className="ml-auto text-[11px] font-medium text-primary">
              {RACK_FINISHES[rack.finish].label}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs text-secondary">Facing</span>
          <SegmentedControl
            label="Rack facing"
            value={rack.orientation}
            onChange={(orientation) => updateRack({ orientation })}
            options={ORIENTATIONS}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
