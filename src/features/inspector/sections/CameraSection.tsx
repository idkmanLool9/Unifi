import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { InfoRow } from '../InfoRow';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { CAMERA } from '@/lib/constants';

export function CameraSection() {
  const activeView = useViewportStore((s) => s.activeView);
  const fov = useViewSettingsStore((s) => s.fov);
  const setFov = useViewSettingsStore((s) => s.setFov);

  return (
    <CollapsibleSection title="Camera">
      <div className="space-y-2">
        <InfoRow label="Projection">Perspective</InfoRow>
        <InfoRow label="View">
          <span className="capitalize">{activeView}</span>
        </InfoRow>
        <Slider
          label="Field of view"
          value={fov}
          min={CAMERA.minFov}
          max={CAMERA.maxFov}
          onChange={setFov}
          format={(v) => `${v}°`}
        />
      </div>
    </CollapsibleSection>
  );
}
