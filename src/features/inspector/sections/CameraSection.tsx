import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { InfoRow } from '../InfoRow';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { CAMERA } from '@/lib/constants';

export function CameraSection() {
  const activeView = useViewportStore((s) => s.activeView);
  const fov = useViewSettingsStore((s) => s.fov);
  const setFov = useViewSettingsStore((s) => s.setFov);
  const zoomSpeed = useViewSettingsStore((s) => s.zoomSpeed);
  const orbitSpeed = useViewSettingsStore((s) => s.orbitSpeed);
  const panSpeed = useViewSettingsStore((s) => s.panSpeed);
  const invertZoom = useViewSettingsStore((s) => s.invertZoom);
  const zoomToPointer = useViewSettingsStore((s) => s.zoomToPointer);
  const fadeObstructions = useViewSettingsStore((s) => s.fadeObstructions);
  const store = useViewSettingsStore;

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
        <Slider
          label="Zoom speed"
          value={zoomSpeed}
          min={0.25}
          max={3}
          step={0.25}
          onChange={(v) => store.getState().setZoomSpeed(v)}
          format={(v) => `${v}×`}
        />
        <Slider
          label="Orbit speed"
          value={orbitSpeed}
          min={0.25}
          max={3}
          step={0.25}
          onChange={(v) => store.getState().setOrbitSpeed(v)}
          format={(v) => `${v}×`}
        />
        <Slider
          label="Pan speed"
          value={panSpeed}
          min={0.25}
          max={3}
          step={0.25}
          onChange={(v) => store.getState().setPanSpeed(v)}
          format={(v) => `${v}×`}
        />
        <div className="flex h-7 items-center justify-between">
          <span className="text-xs text-secondary">Zoom toward pointer</span>
          <Switch
            label="Zoom toward pointer"
            checked={zoomToPointer}
            onChange={() => store.getState().toggleZoomToPointer()}
          />
        </div>
        <div className="flex h-7 items-center justify-between">
          <span className="text-xs text-secondary">Invert zoom</span>
          <Switch
            label="Invert zoom"
            checked={invertZoom}
            onChange={() => store.getState().toggleInvertZoom()}
          />
        </div>
        <div className="flex h-7 items-center justify-between">
          <span className="text-xs text-secondary">Fade obstructions</span>
          <Switch
            label="Fade obstructions during close-up"
            checked={fadeObstructions}
            onChange={() => store.getState().toggleFadeObstructions()}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
