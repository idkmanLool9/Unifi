import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { InfoRow } from '../InfoRow';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

const asPercent = (v: number) => `${Math.round(v * 100)}%`;

export function LightingSection() {
  const keyLight = useViewSettingsStore((s) => s.keyLightIntensity);
  const ambient = useViewSettingsStore((s) => s.ambientIntensity);
  const setKeyLight = useViewSettingsStore((s) => s.setKeyLightIntensity);
  const setAmbient = useViewSettingsStore((s) => s.setAmbientIntensity);

  return (
    <CollapsibleSection title="Lighting" defaultOpen={false}>
      <div className="space-y-2.5">
        <InfoRow label="Environment">Studio</InfoRow>
        <Slider
          label="Key light"
          value={keyLight}
          min={0}
          max={2}
          step={0.05}
          onChange={setKeyLight}
          format={asPercent}
        />
        <Slider
          label="Ambient"
          value={ambient}
          min={0}
          max={2}
          step={0.05}
          onChange={setAmbient}
          format={asPercent}
        />
      </div>
    </CollapsibleSection>
  );
}
