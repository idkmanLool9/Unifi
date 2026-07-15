import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Switch } from '@/components/ui/Switch';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex h-7 items-center justify-between">
      <span className="text-xs text-secondary">{label}</span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

export function ViewSection() {
  const s = useViewSettingsStore();

  return (
    <CollapsibleSection title="View">
      <SwitchRow
        label="Floor grid"
        checked={s.gridVisible}
        onChange={s.toggleGrid}
      />
      <SwitchRow
        label="Shadows"
        checked={s.shadowsEnabled}
        onChange={s.toggleShadows}
      />
      <SwitchRow
        label="Snapping"
        checked={s.snapEnabled}
        onChange={s.toggleSnap}
      />
      <SwitchRow
        label="Viewport hints"
        checked={s.hintsVisible}
        onChange={s.toggleHints}
      />
    </CollapsibleSection>
  );
}
