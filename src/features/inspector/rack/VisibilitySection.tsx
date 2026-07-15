import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Switch } from '@/components/ui/Switch';
import { useRackStore } from '@/stores/rackStore';
import type { RackConfig } from '@/types';

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex h-7 items-center justify-between">
      <span className="text-xs text-secondary">{label}</span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

export function VisibilitySection({ rack }: { rack: RackConfig }) {
  const updateRack = useRackStore((s) => s.updateRack);

  return (
    <CollapsibleSection title="Visibility">
      <SwitchRow
        label="Unit numbers"
        checked={rack.showUnitNumbers}
        onChange={() => updateRack({ showUnitNumbers: !rack.showUnitNumbers })}
      />
      <SwitchRow
        label="Rear posts"
        checked={rack.showRearPosts}
        onChange={() => updateRack({ showRearPosts: !rack.showRearPosts })}
      />
      <SwitchRow
        label="Floor marker"
        checked={rack.showFloorMarker}
        onChange={() => updateRack({ showFloorMarker: !rack.showFloorMarker })}
      />
    </CollapsibleSection>
  );
}
