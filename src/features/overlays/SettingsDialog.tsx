import { useState, type ReactNode } from 'react';
import {
  Camera,
  Gauge,
  Keyboard,
  Palette,
  Settings2,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useOverlayStore } from '@/stores/overlayStore';
import { useUIStore } from '@/stores/uiStore';
import {
  useViewSettingsStore,
  type MeasurementUnits,
} from '@/stores/viewSettingsStore';
import { useEtherlightingStore } from '@/features/devices/hardware/etherlighting/etherlightingStore';
import {
  ETHER_ANIMATION_MODES,
  ETHER_COLOR_MODES,
} from '@/features/devices/deviceSchema';
import { CAMERA } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ThemePreference } from '@/types';

type SectionId =
  | 'general'
  | 'appearance'
  | 'viewport'
  | 'etherlighting'
  | 'performance'
  | 'shortcuts'
  | 'ai';

const SECTIONS: ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'viewport', label: 'Viewport', icon: Camera },
  { id: 'etherlighting', label: 'Etherlighting', icon: Zap },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles, soon: true },
];

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-snug text-secondary">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * The dedicated Etherlighting section: every global knob of the
 * metadata-driven lighting layer, saving instantly. Device and port
 * overrides refine these values; this is the base of the hierarchy.
 */
function EtherlightingSettings() {
  const settings = useEtherlightingStore((s) => s.settings);
  const patch = useEtherlightingStore((s) => s.patch);
  const setSpeedColor = useEtherlightingStore((s) => s.setSpeedColor);
  const reset = useEtherlightingStore((s) => s.reset);

  const selectClass =
    'h-7 rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none';

  return (
    <>
      <Row label="Enable Etherlighting" description="Automatic port lighting from authored metadata">
        <Switch
          label="Enable Etherlighting"
          checked={settings.enabled}
          onChange={(enabled) => patch({ enabled })}
        />
      </Row>
      <Row label="Color mode" description="How every port picks its hue">
        <select
          aria-label="Etherlighting color mode"
          value={settings.colorMode}
          onChange={(e) =>
            patch({ colorMode: e.target.value as typeof settings.colorMode })
          }
          className={selectClass}
        >
          {ETHER_COLOR_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Animation mode" description="Default motion for every frame">
        <select
          aria-label="Etherlighting animation mode"
          value={settings.animationMode}
          onChange={(e) =>
            patch({
              animationMode: e.target.value as typeof settings.animationMode,
            })
          }
          className={selectClass}
        >
          {ETHER_ANIMATION_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Default brightness">
        <div className="w-44">
          <Slider
            label="Default brightness"
            value={settings.brightness}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(brightness) => patch({ brightness })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="Maximum brightness" description="Ceiling for any override">
        <div className="w-44">
          <Slider
            label="Maximum brightness"
            value={settings.maxBrightness}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(maxBrightness) => patch({ maxBrightness })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="Animation speed">
        <div className="w-44">
          <Slider
            label="Animation speed"
            value={settings.animationSpeed}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(animationSpeed) => patch({ animationSpeed })}
            format={(v) => `${v.toFixed(1)}×`}
          />
        </div>
      </Row>
      <Row label="Transition speed" description="Color change easing">
        <div className="w-44">
          <Slider
            label="Transition speed"
            value={settings.transitionSpeed}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(transitionSpeed) => patch({ transitionSpeed })}
            format={(v) => `${v.toFixed(1)}×`}
          />
        </div>
      </Row>
      <Row label="Saturation">
        <div className="w-44">
          <Slider
            label="Global saturation"
            value={settings.saturation}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(saturation) => patch({ saturation })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="Intensity">
        <div className="w-44">
          <Slider
            label="Global intensity"
            value={settings.intensity}
            min={0.2}
            max={2.5}
            step={0.05}
            onChange={(intensity) => patch({ intensity })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="Glow radius" description="Frame band width around each opening">
        <div className="w-44">
          <Slider
            label="Glow radius"
            value={settings.glowRadius}
            min={0.08}
            max={0.6}
            step={0.02}
            onChange={(glowRadius) => patch({ glowRadius })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="HDR emissive strength" description="Feeds bloom above 1.0">
        <div className="w-44">
          <Slider
            label="HDR emissive strength"
            value={settings.hdrStrength}
            min={1}
            max={4}
            step={0.1}
            onChange={(hdrStrength) => patch({ hdrStrength })}
            format={(v) => v.toFixed(1)}
          />
        </div>
      </Row>
      <Row label="Bloom strength">
        <div className="w-44">
          <Slider
            label="Bloom strength"
            value={settings.bloomStrength}
            min={0}
            max={2}
            step={0.05}
            onChange={(bloomStrength) => patch({ bloomStrength })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Row>
      <Row label="Render distance" description="Frames cull beyond this camera distance">
        <div className="w-44">
          <Slider
            label="Render distance"
            value={settings.renderDistanceM}
            min={1}
            max={20}
            step={0.5}
            onChange={(renderDistanceM) => patch({ renderDistanceM })}
            format={(v) => `${v.toFixed(1)} m`}
          />
        </div>
      </Row>
      <Row label="GPU quality">
        <div className="w-44">
          <SegmentedControl
            label="GPU quality"
            value={settings.quality}
            onChange={(quality) => patch({ quality })}
            options={[
              { value: 'performance', label: 'Perf' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
      </Row>
      <Row label="Enable bloom">
        <Switch
          label="Enable bloom"
          checked={settings.enableBloom}
          onChange={(enableBloom) => patch({ enableBloom })}
        />
      </Row>
      <Row label="Enable HDR">
        <Switch
          label="Enable HDR"
          checked={settings.enableHdr}
          onChange={(enableHdr) => patch({ enableHdr })}
        />
      </Row>
      <Row label="Enable animations">
        <Switch
          label="Enable animations"
          checked={settings.enableAnimations}
          onChange={(enableAnimations) => patch({ enableAnimations })}
        />
      </Row>

      <div className="py-2.5">
        <p className="text-xs font-medium text-primary">Speed colors</p>
        <p className="mt-0.5 text-[11px] leading-snug text-secondary">
          Global link-speed palette used by the speed color mode.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {Object.entries(settings.speedPalette).map(([speed, hex]) => (
            <label
              key={speed}
              className="flex items-center justify-between gap-1.5 rounded-lg border border-edge px-2 py-1"
            >
              <span className="text-[10.5px] font-medium uppercase text-secondary">
                {speed}
              </span>
              <input
                type="color"
                aria-label={`Color for ${speed}`}
                value={hex}
                onChange={(e) => setSpeedColor(speed, e.target.value)}
                className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="py-2">
        <button
          type="button"
          onClick={reset}
          className="h-7 rounded-lg border border-edge px-3 text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
        >
          Reset Etherlighting to defaults
        </button>
      </div>
    </>
  );
}

function SoonBadge() {
  return (
    <span className="rounded-sm bg-surface-active px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-muted uppercase">
      Soon
    </span>
  );
}

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> =
  [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

const UNIT_OPTIONS: ReadonlyArray<{ value: MeasurementUnits; label: string }> =
  [
    { value: 'metric', label: 'Metric' },
    { value: 'imperial', label: 'Imperial' },
  ];

function SectionContent({ section }: { section: SectionId }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const view = useViewSettingsStore();
  const setShortcutsOpen = useOverlayStore((s) => s.setShortcutsOpen);
  const [quality, setQuality] = useState('balanced');

  switch (section) {
    case 'general':
      return (
        <>
          <Row
            label="Measurement units"
            description="Used for dimensions across the app"
          >
            <div className="w-44">
              <SegmentedControl
                label="Measurement units"
                value={view.units}
                onChange={view.setUnits}
                options={UNIT_OPTIONS}
              />
            </div>
          </Row>
          <Row label="Language" description="Interface language">
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">English</span>
              <SoonBadge />
            </div>
          </Row>
          <Row
            label="Autosave"
            description="Save the project automatically while editing"
          >
            <div className="flex items-center gap-2">
              <SoonBadge />
              <Switch label="Autosave" checked disabled onChange={() => {}} />
            </div>
          </Row>
        </>
      );
    case 'appearance':
      return (
        <>
          <Row label="Theme" description="Follow the OS or pick one">
            <div className="w-52">
              <SegmentedControl
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={THEME_OPTIONS}
              />
            </div>
          </Row>
          <Row label="Accent color" description="Used for selection and actions">
            <div className="flex items-center gap-1.5">
              {['#4c82f7', '#8b5cf6', '#10b981', '#f59e0b'].map((c, i) => (
                <button
                  key={c}
                  type="button"
                  disabled
                  aria-label={`Accent ${i + 1}`}
                  className={cn(
                    'size-5 rounded-full opacity-60',
                    i === 0 && 'ring-2 ring-accent ring-offset-2 ring-offset-surface opacity-100',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <SoonBadge />
            </div>
          </Row>
        </>
      );
    case 'viewport':
      return (
        <>
          <Row label="Floor grid" description="Show the reference grid">
            <Switch
              label="Floor grid"
              checked={view.gridVisible}
              onChange={view.toggleGrid}
            />
          </Row>
          <Row label="Snapping" description="Snap devices to rack units">
            <Switch
              label="Snapping"
              checked={view.snapEnabled}
              onChange={view.toggleSnap}
            />
          </Row>
          <Row label="Viewport hints" description="Show navigation help overlay">
            <Switch
              label="Viewport hints"
              checked={view.hintsVisible}
              onChange={view.toggleHints}
            />
          </Row>
          <div className="py-2.5">
            <Slider
              label="Field of view"
              value={view.fov}
              min={CAMERA.minFov}
              max={CAMERA.maxFov}
              onChange={view.setFov}
              format={(v) => `${v}°`}
            />
          </div>
        </>
      );
    case 'etherlighting':
      return <EtherlightingSettings />;
    case 'performance':
      return (
        <>
          <Row
            label="Rendering quality"
            description="Balances fidelity against battery and thermals"
          >
            <div className="w-52">
              <SegmentedControl
                label="Rendering quality"
                value={quality}
                onChange={setQuality}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
          </Row>
          <Row label="Shadows" description="Real-time contact shadows">
            <Switch
              label="Shadows"
              checked={view.shadowsEnabled}
              onChange={view.toggleShadows}
            />
          </Row>
          <Row
            label="Ambient occlusion"
            description="Screen-space AO for extra depth"
          >
            <Switch
              label="Ambient occlusion"
              checked={view.aoEnabled}
              onChange={view.toggleAO}
            />
          </Row>
        </>
      );
    case 'shortcuts':
      return (
        <div className="py-2.5">
          <p className="text-xs leading-relaxed text-secondary">
            RackForge uses single-key shortcuts for tools and views, with
            modifier chords for app-level actions.
          </p>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            View all shortcuts
          </button>
        </div>
      );
    case 'ai':
      return (
        <div className="py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" strokeWidth={1.75} />
            <p className="text-xs font-medium text-primary">
              AI Layout Assistant
            </p>
            <SoonBadge />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-secondary">
            Describe your infrastructure and let RackForge propose complete
            rack layouts — device selection, placement, power budgets and
            cable paths. Configuration options will appear here when the
            assistant ships.
          </p>
        </div>
      );
  }
}

export function SettingsDialog() {
  const open = useOverlayStore((s) => s.settingsOpen);
  const setOpen = useOverlayStore((s) => s.setSettingsOpen);
  const [section, setSection] = useState<SectionId>('general');

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Settings"
      width={640}
    >
      <div className="flex min-h-[380px]">
        <nav className="w-44 shrink-0 space-y-0.5 border-r border-edge p-2">
          {SECTIONS.map(({ id, label, icon: Icon, soon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id}
              onClick={() => setSection(id)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left transition-colors duration-75',
                section === id
                  ? 'bg-accent-soft text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-primary',
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate text-xs font-medium">
                {label}
              </span>
              {soon && (
                <span className="size-1.5 rounded-full bg-accent/60" aria-hidden />
              )}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 divide-y divide-edge overflow-y-auto px-5 py-2">
          <SectionContent section={section} />
        </div>
      </div>
    </Dialog>
  );
}
