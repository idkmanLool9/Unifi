import { motion } from 'framer-motion';
import {
  Box,
  DoorClosed,
  DoorOpen,
  Eye,
  Layers,
  RotateCcw,
  Route,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useCabinetStore } from '@/stores/cabinetStore';
import {
  DEFAULT_CABINET_LIGHTS,
  defaultInstance,
  type CabinetMode,
  type TransparencyMode,
} from '@/features/cabinet/cabinetRuntime';
import type {
  CabinetModelDef,
  CabinetPartDef,
  CabinetPartState,
} from '@/features/cabinet/cabinetSchema';
import {
  focusCabinetFace,
  focusCabinetInterior,
} from '@/features/viewport/focusActions';
import type { RackConfig } from '@/types';

/**
 * The Cabinet menu — shown only when the selected rack is an interactive
 * cabinet. Everything here is derived from the cabinet's metadata parts
 * (doors, panels, covers, frame, rails), so it works unchanged for every
 * current and future cabinet model: nothing is hardcoded for one enclosure.
 */

const STATE_LABEL: Record<CabinetPartState, string> = {
  closed: 'Closed',
  open: 'Open',
  installed: 'On',
  hidden: 'Hidden',
  removed: 'Removed',
};

const TRANSPARENCY_OPTIONS: ReadonlyArray<{
  value: TransparencyMode;
  label: string;
}> = [
  { value: 'off', label: 'Solid' },
  { value: 'p50', label: '50%' },
  { value: 'p75', label: '75%' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'xray', label: 'X-Ray' },
];

const MODE_OPTIONS: ReadonlyArray<{ value: CabinetMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'interior', label: 'Interior' },
  { value: 'maintenance', label: 'Service' },
  { value: 'exploded', label: 'Explode' },
];

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] border border-edge bg-surface-raised text-secondary shadow-xs transition-colors duration-100 hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
    >
      <Icon className="size-4" strokeWidth={1.75} />
      <span className="text-[10px] font-medium">{label}</span>
    </motion.button>
  );
}

export function CabinetSection({
  rack,
  model,
}: {
  rack: RackConfig;
  model: CabinetModelDef;
}) {
  const rackId = rack.id;
  const instance =
    useCabinetStore((s) => s.instances[rackId]) ?? defaultInstance(model);

  const setPartState = useCabinetStore((s) => s.setPartState);
  const setDoorAngle = useCabinetStore((s) => s.setDoorAngle);
  const openAllDoors = useCabinetStore((s) => s.openAllDoors);
  const closeAllDoors = useCabinetStore((s) => s.closeAllDoors);
  const hideAllPanels = useCabinetStore((s) => s.hideAllPanels);
  const restore = useCabinetStore((s) => s.restore);
  const setMode = useCabinetStore((s) => s.setMode);
  const setTransparency = useCabinetStore((s) => s.setTransparency);
  const setAnimationSpeed = useCabinetStore((s) => s.setAnimationSpeed);
  const setLights = useCabinetStore((s) => s.setLights);
  const lights = instance.lights ?? DEFAULT_CABINET_LIGHTS;

  const stateOf = (part: CabinetPartDef): CabinetPartState =>
    instance.parts[part.id]?.state ?? part.defaultState;

  const doors = model.parts.filter((p) => p.interaction === 'hinge');
  const movables = model.parts.filter(
    (p) =>
      p.interaction === 'remove' ||
      p.interaction === 'lift' ||
      p.interaction === 'sliding',
  );
  const toggles = model.parts.filter((p) => p.interaction === 'visibility');

  return (
    <>
      <CollapsibleSection title="Cabinet">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <ActionButton
              icon={DoorOpen}
              label="Open doors"
              onClick={() => openAllDoors(rackId, model)}
            />
            <ActionButton
              icon={DoorClosed}
              label="Close doors"
              onClick={() => closeAllDoors(rackId, model)}
            />
            <ActionButton
              icon={Eye}
              label="Hide panels"
              onClick={() => hideAllPanels(rackId, model)}
            />
            <ActionButton
              icon={RotateCcw}
              label="Restore"
              onClick={() => restore(rackId, model)}
            />
            <ActionButton
              icon={Box}
              label="Interior"
              onClick={() => {
                setMode(rackId, model, 'interior');
                focusCabinetInterior();
              }}
            />
            <ActionButton
              icon={Route}
              label="Rear routing"
              onClick={() => focusCabinetFace('rear')}
            />
            <ActionButton
              icon={Wrench}
              label="Maintenance"
              onClick={() => setMode(rackId, model, 'maintenance')}
            />
            <ActionButton
              icon={Layers}
              label="Explode"
              onClick={() => setMode(rackId, model, 'exploded')}
            />
          </div>

          <div className="space-y-1 pt-1">
            <span className="block text-xs text-secondary">View mode</span>
            <SegmentedControl
              label="Cabinet view mode"
              value={instance.mode}
              onChange={(mode) => {
                setMode(rackId, model, mode);
                if (mode === 'interior') focusCabinetInterior();
              }}
              options={MODE_OPTIONS}
            />
          </div>
        </div>
      </CollapsibleSection>

      {doors.length > 0 && (
        <CollapsibleSection title="Doors">
          <div className="space-y-3">
            {doors.map((door) => {
              const open = stateOf(door) === 'open';
              const angle =
                instance.parts[door.id]?.angleDeg ?? door.hinge?.openDeg ?? 90;
              return (
                <div key={door.id} className="space-y-1.5">
                  <SegmentedControl
                    label={door.name}
                    value={open ? 'open' : 'closed'}
                    onChange={(v) =>
                      setPartState(rackId, model, door.id, v as CabinetPartState)
                    }
                    options={[
                      { value: 'closed', label: `${door.name}: Closed` },
                      { value: 'open', label: 'Open' },
                    ]}
                  />
                  {open && door.hinge && (
                    <Slider
                      label="Open angle"
                      value={Math.round(angle)}
                      min={0}
                      max={door.hinge.maxDeg}
                      step={5}
                      onChange={(deg) =>
                        setDoorAngle(rackId, model, door.id, deg)
                      }
                      format={(v) => `${v}°`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {movables.length > 0 && (
        <CollapsibleSection title="Panels & Covers">
          <div className="space-y-2.5">
            {movables.map((part) => (
              <div key={part.id} className="space-y-1">
                <span className="block text-xs text-secondary">
                  {part.name}
                </span>
                <SegmentedControl
                  label={part.name}
                  value={stateOf(part)}
                  onChange={(s) => setPartState(rackId, model, part.id, s)}
                  options={part.states.map((s) => ({
                    value: s,
                    label: STATE_LABEL[s],
                  }))}
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {toggles.length > 0 && (
        <CollapsibleSection title="Frame & Hardware">
          <div className="space-y-2">
            {toggles.map((part) => (
              <div
                key={part.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-secondary">{part.name}</span>
                <Switch
                  label={`Show ${part.name}`}
                  checked={stateOf(part) !== 'hidden'}
                  onChange={(on) =>
                    setPartState(
                      rackId,
                      model,
                      part.id,
                      on ? 'installed' : 'hidden',
                    )
                  }
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Interior Lighting">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary">LED strips (both sides)</span>
            <Switch
              label="Interior LED strips"
              checked={lights.on}
              onChange={(on) => setLights(rackId, model, { on })}
            />
          </div>
          <Slider
            label="Brightness"
            value={Math.round(lights.brightness * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => setLights(rackId, model, { brightness: v / 100 })}
            format={(v) => `${v}%`}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary">Color</span>
            <input
              type="color"
              aria-label="Interior LED color"
              value={lights.color}
              onChange={(e) => setLights(rackId, model, { color: e.target.value })}
              className="h-6 w-9 cursor-pointer rounded border-0 bg-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['Cool', '#dcebff'],
                ['Warm', '#ffd9a8'],
                ['White', '#ffffff'],
                ['UniFi', '#4c82f7'],
              ] as const
            ).map(([label, hex]) => (
              <button
                key={hex}
                type="button"
                onClick={() => setLights(rackId, model, { color: hex })}
                className="flex items-center gap-1.5 rounded-md border border-edge px-2 py-1 text-[10px] font-medium text-secondary transition-colors hover:bg-surface-hover"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: hex }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Transparency & Motion">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <span className="block text-xs text-secondary">Transparency</span>
            <SegmentedControl
              label="Cabinet transparency"
              value={instance.transparency}
              onChange={(t) => setTransparency(rackId, model, t)}
              options={TRANSPARENCY_OPTIONS}
            />
          </div>
          <Slider
            label="Animation speed"
            value={instance.animationSpeed}
            min={0.25}
            max={3}
            step={0.25}
            onChange={(v) => setAnimationSpeed(rackId, model, v)}
            format={(v) => `${v.toFixed(2)}×`}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Camera">
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton
            icon={Box}
            label="Interior"
            onClick={focusCabinetInterior}
          />
          <ActionButton
            icon={Eye}
            label="Front"
            onClick={() => focusCabinetFace('front')}
          />
          <ActionButton
            icon={Route}
            label="Rear"
            onClick={() => focusCabinetFace('rear')}
          />
          <ActionButton
            icon={Eye}
            label="Left"
            onClick={() => focusCabinetFace('left')}
          />
          <ActionButton
            icon={Eye}
            label="Right"
            onClick={() => focusCabinetFace('right')}
          />
        </div>
      </CollapsibleSection>
    </>
  );
}
