import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { getDevice, registerDevice } from '@/features/devices/deviceRegistry';
import { ETHER_COLOR_MODES } from '@/features/devices/deviceSchema';
import { useLibraryMetaStore } from '@/features/library/workspace/libraryMetaStore';
import type {
  DeviceDefinition,
  EtherColorMode,
  LightingCapabilities,
} from '@/features/devices/deviceSchema';

/**
 * Device-level Etherlighting overrides. Every authored port lights
 * automatically; this section refines the whole device — enabled,
 * brightness, mode, color mode — persisting as a definition patch so
 * the override survives reloads and applies over any metadata layer.
 */
export function EtherlightingDeviceSection({
  definition,
}: {
  definition: DeviceDefinition;
}) {
  const setDefinitionPatch = useLibraryMetaStore((s) => s.setDefinitionPatch);
  const lighting = definition.lighting;

  const patchLighting = (patch: Partial<LightingCapabilities>) => {
    const current = getDevice(definition.id);
    if (!current) return;
    const merged: LightingCapabilities = {
      etherlighting: true,
      perPortLink: false,
      poeIndicator: false,
      speedColors: {},
      effects: [],
      ...current.lighting,
      ...patch,
    };
    registerDevice({ ...current, lighting: merged });
    setDefinitionPatch(definition.id, { lighting: merged });
  };

  const enabled = lighting?.etherlighting !== false;

  return (
    <CollapsibleSection title="Etherlighting" defaultOpen={false}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary">Enabled on this device</span>
          <Switch
            label="Etherlighting enabled on this device"
            checked={enabled}
            onChange={(on) => patchLighting({ etherlighting: on })}
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs text-secondary">Color mode</span>
          <select
            aria-label="Device color mode override"
            value={lighting?.colorMode ?? ''}
            onChange={(e) =>
              patchLighting({
                colorMode: (e.target.value || undefined) as
                  | EtherColorMode
                  | undefined,
              })
            }
            className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Inherit global</option>
            {ETHER_COLOR_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <Slider
          label="Device brightness"
          value={lighting?.brightness ?? 0.9}
          min={0}
          max={1}
          step={0.05}
          onChange={(brightness) => patchLighting({ brightness })}
          format={(v) => v.toFixed(2)}
        />
        <p className="text-[10px] leading-snug text-muted">
          Ports light automatically from their authored bounds — per-port
          refinements live in Device Authoring.
        </p>
      </div>
    </CollapsibleSection>
  );
}
