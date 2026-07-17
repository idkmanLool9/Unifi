import { useEffect, useState } from 'react';
import {
  primaryPort,
  selectedPorts,
  useAuthoringStore,
} from './authoringStore';
import { round2, type AuthoredPort, type Vec3 } from './authoringModel';
import { ETHER_ANIMATION_MODES } from '@/features/devices/deviceSchema';
import { useValidation } from './useValidation';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useImportReportStore } from '@/features/devices/import/importReportStore';
import {
  LED_KINDS,
  PORT_TYPES,
  type LedKind,
  type PortType,
} from '@/features/devices/deviceSchema';

/**
 * Right inspector — category-driven. Every field writes straight into
 * the authoring store (undoable); nothing is read-only decoration.
 */

const SPEED_OPTIONS = [
  { value: '', label: 'None' },
  { value: '0.1', label: '100 Mbps' },
  { value: '1', label: '1 Gbps' },
  { value: '2.5', label: '2.5 Gbps' },
  { value: '5', label: '5 Gbps' },
  { value: '10', label: '10 Gbps' },
  { value: '25', label: '25 Gbps' },
  { value: '40', label: '40 Gbps' },
  { value: '100', label: '100 Gbps' },
];

const inputClass =
  'h-6 w-full rounded-md border border-edge bg-background/40 px-1.5 text-[11px] text-primary tabular-nums outline-none transition-colors focus:border-accent/60';

/** Numeric field that commits on blur/Enter and tracks external edits. */
function NumField({
  value,
  onCommit,
  step = 0.1,
  suffix,
}: {
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onCommit(round2(parsed));
    else setText(String(value));
  };
  return (
    <div className="relative">
      <input
        type="number"
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={inputClass}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[68px_1fr] items-center gap-2">
      <span className="text-[11px] text-secondary">{label}</span>
      {children}
    </div>
  );
}

function TripleRow({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: Vec3;
  onCommit: (value: Vec3) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-secondary">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <NumField
            key={axis}
            value={value[i]}
            onCommit={(v) => {
              const next = [...value] as Vec3;
              next[i] = v;
              onCommit(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-secondary">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** ID editor that only commits valid, unique ids on blur/Enter. */
function IdField({
  id,
  onRename,
}: {
  id: string;
  onRename: (next: string) => void;
}) {
  const [text, setText] = useState(id);
  useEffect(() => setText(id), [id]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onRename(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={inputClass}
    />
  );
}

const emptyState = (message: string) => (
  <div className="px-4 py-6 text-center text-xs leading-relaxed text-muted">
    {message}
  </div>
);

/* ---- ports / power ---------------------------------------------------- */

function PortSections() {
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const updatePort = useAuthoringStore((s) => s.updatePort);
  const renamePort = useAuthoringStore((s) => s.renamePort);
  const previewVisible = useAuthoringStore((s) => s.previewVisible);
  const setPreviewVisible = useAuthoringStore((s) => s.setPreviewVisible);
  const previewIntensity = useAuthoringStore((s) => s.previewIntensity);
  const setPreviewIntensity = useAuthoringStore((s) => s.setPreviewIntensity);

  const port = primaryPort({ ports, selection });
  const selected = selectedPorts({ ports, selection });
  if (!port) {
    return emptyState(
      'Select a connector in the viewport or the list below. Shift-click adds; Shift-drag box-selects.',
    );
  }
  const update = (patch: Partial<AuthoredPort>) => updatePort(port.id, patch);

  return (
    <>
      {selected.length > 1 && (
        <div className="border-b border-edge bg-accent/8 px-3 py-2 text-[11px] text-secondary">
          {selected.length} selected — editing{' '}
          <span className="font-medium text-primary">{port.id}</span>
        </div>
      )}

      <CollapsibleSection title="GENERAL">
        <div className="space-y-2">
          <Row label="Type">
            <select
              value={port.type}
              onChange={(e) => update({ type: e.target.value as PortType })}
              className={inputClass}
            >
              {PORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </Row>
          <Row label="ID">
            <IdField id={port.id} onRename={(next) => renamePort(port.id, next)} />
          </Row>
          <Row label="Label">
            <input
              value={port.label ?? ''}
              onChange={(e) => update({ label: e.target.value || undefined })}
              placeholder="e.g. 1, WAN, Console"
              className={inputClass}
            />
          </Row>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="TRANSFORM (MM)">
        <div className="space-y-2">
          <TripleRow
            label="Position"
            value={port.positionMm}
            onCommit={(positionMm) => update({ positionMm })}
          />
          <TripleRow
            label="Rotation (°)"
            value={port.rotationDeg}
            onCommit={(rotationDeg) => update({ rotationDeg })}
          />
          <div className="space-y-1">
            <span className="text-[11px] text-secondary">
              Opening size (W × H)
            </span>
            <div className="grid grid-cols-2 gap-1">
              <NumField
                value={port.sizeMm[0]}
                onCommit={(v) => update({ sizeMm: [Math.max(2, v), port.sizeMm[1]] })}
                suffix="mm"
              />
              <NumField
                value={port.sizeMm[1]}
                onCommit={(v) => update({ sizeMm: [port.sizeMm[0], Math.max(2, v)] })}
                suffix="mm"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="PROPERTIES">
        <div className="space-y-2">
          <Row label="Side">
            <select
              value={port.location}
              onChange={(e) => {
                const location = e.target.value as 'front' | 'rear';
                update({
                  location,
                  positionMm: [
                    port.positionMm[0],
                    port.positionMm[1],
                    -port.positionMm[2],
                  ],
                  anchorMm: [
                    port.anchorMm[0],
                    port.anchorMm[1],
                    -port.anchorMm[2],
                  ],
                });
              }}
              className={inputClass}
            >
              <option value="front">Front</option>
              <option value="rear">Rear</option>
            </select>
          </Row>
          <Row label="Speed">
            <select
              value={port.speedGbps?.toString() ?? ''}
              onChange={(e) =>
                update({
                  speedGbps: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={inputClass}
            >
              {SPEED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
          <SwitchRow
            label="PoE"
            checked={port.poe}
            onChange={(poe) => update({ poe })}
          />
          {port.poe && (
            <Row label="PoE Budget">
              <NumField
                value={port.poeBudgetW ?? 0}
                step={1}
                suffix="W"
                onCommit={(v) => update({ poeBudgetW: v > 0 ? v : undefined })}
              />
            </Row>
          )}
          <SwitchRow
            label="Etherlighting"
            checked={port.etherlighting}
            onChange={(etherlighting) => update({ etherlighting })}
          />
          <SwitchRow
            label="Visible"
            checked={port.visible}
            onChange={(visible) => update({ visible })}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="VISUAL" defaultOpen={false}>
        <div className="space-y-2.5">
          <SwitchRow
            label="Show highlight (preview)"
            checked={previewVisible}
            onChange={setPreviewVisible}
          />
          <Slider
            label="Highlight intensity"
            value={previewIntensity}
            min={0.1}
            max={1}
            step={0.05}
            onChange={setPreviewIntensity}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="ETHERLIGHTING" defaultOpen={false}>
        <PortEtherSection port={port} update={update} />
      </CollapsibleSection>
    </>
  );
}

/**
 * Per-port Etherlighting overrides. Every port lights automatically —
 * these fields only refine the global/device behavior, and clearing
 * them returns the port to the inherited values.
 */
function PortEtherSection({
  port,
  update,
}: {
  port: AuthoredPort;
  update: (patch: Partial<AuthoredPort>) => void;
}) {
  const override = port.etherLighting ?? {};
  const patch = (next: Partial<typeof override>) => {
    const merged = { ...override, ...next };
    // Drop keys reset to undefined so 'inherited' stays inherited.
    for (const key of Object.keys(merged) as Array<keyof typeof merged>) {
      if (merged[key] === undefined) delete merged[key];
    }
    update({
      etherLighting: Object.keys(merged).length > 0 ? merged : undefined,
    });
  };

  return (
    <div className="space-y-2.5">
      <SwitchRow
        label="Lit (inherits when on)"
        checked={override.enabled !== false}
        onChange={(on) => patch({ enabled: on ? undefined : false })}
      />
      <div className="space-y-1">
        <span className="block text-xs text-secondary">Animation override</span>
        <select
          aria-label="Port animation override"
          value={override.animationMode ?? ''}
          onChange={(e) =>
            patch({
              animationMode: (e.target.value ||
                undefined) as typeof override.animationMode,
            })
          }
          className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
        >
          <option value="">Inherit</option>
          {ETHER_ANIMATION_MODES.filter((m) => m !== 'off').map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <span className="block text-xs text-secondary">Zones</span>
        <div className="flex flex-wrap gap-1">
          {(['full', 'top', 'bottom', 'left', 'right', 'corners', 'inner', 'outer'] as const).map(
            (zone) => {
              const zones = override.zones ?? [];
              const active = zones.includes(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? zones.filter((z) => z !== zone)
                      : [...zones, zone];
                    patch({ zones: next.length > 0 ? next : undefined });
                  }}
                  className={
                    active
                      ? 'rounded-full border border-accent/50 bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent'
                      : 'rounded-full border border-edge px-2 py-0.5 text-[10px] font-medium text-secondary hover:bg-raised'
                  }
                >
                  {zone}
                </button>
              );
            },
          )}
        </div>
        <p className="text-[10px] leading-snug text-muted">
          No selection inherits the global zones.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-secondary">Custom color</span>
        <input
          type="color"
          aria-label="Port custom Etherlighting color"
          value={override.customColor ?? '#4c82f7'}
          onChange={(e) =>
            patch({ customColor: e.target.value, colorMode: 'custom' })
          }
          className="h-6 w-10 cursor-pointer rounded border border-edge bg-transparent"
        />
      </div>
      {override.customColor && (
        <button
          type="button"
          onClick={() => patch({ customColor: undefined, colorMode: undefined })}
          className="h-6 w-full rounded-lg border border-edge text-[10.5px] font-medium text-secondary transition-colors hover:bg-raised"
        >
          Clear custom color (inherit)
        </button>
      )}
      <Slider
        label="Brightness override"
        value={override.brightness ?? 0.9}
        min={0}
        max={1.6}
        step={0.05}
        onChange={(brightness) => patch({ brightness })}
        format={(v) => v.toFixed(2)}
      />
      <Slider
        label="Glow radius"
        value={override.glowRadius ?? 0.24}
        min={0.08}
        max={0.6}
        step={0.02}
        onChange={(glowRadius) => patch({ glowRadius })}
        format={(v) => v.toFixed(2)}
      />
    </div>
  );
}

/* ---- cable anchors ---------------------------------------------------- */

type ExitPreset = 'straight' | 'up' | 'down' | 'left' | 'right' | 'custom';

const EXIT_PRESETS: Record<Exclude<ExitPreset, 'custom'>, Vec3 | undefined> = {
  straight: undefined,
  up: [0, 1, 1],
  down: [0, -1, 1],
  left: [-1, 0, 1],
  right: [1, 0, 1],
};

function presetOf(port: AuthoredPort): ExitPreset {
  const dir = port.exitDirMm;
  if (!dir) return 'straight';
  const out = port.location === 'front' ? 1 : -1;
  for (const [name, preset] of Object.entries(EXIT_PRESETS)) {
    if (!preset) continue;
    if (
      Math.abs(dir[0] - preset[0]) < 0.01 &&
      Math.abs(dir[1] - preset[1]) < 0.01 &&
      Math.abs(dir[2] - preset[2] * out) < 0.01
    ) {
      return name as ExitPreset;
    }
  }
  return 'custom';
}

function AnchorSections() {
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const select = useAuthoringStore((s) => s.select);
  const updatePort = useAuthoringStore((s) => s.updatePort);

  const port = primaryPort({ ports, selection });
  const update = (patch: Partial<AuthoredPort>) =>
    port && updatePort(port.id, patch);

  return (
    <>
      <CollapsibleSection title="CABLE ANCHOR">
        <Row label="Port">
          <select
            value={port?.id ?? ''}
            onChange={(e) => e.target.value && select(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a port…
            </option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} ({p.type.toUpperCase()})
              </option>
            ))}
          </select>
        </Row>
      </CollapsibleSection>

      {!port ? (
        emptyState('Pick a port to author how its cable connects.')
      ) : (
        <>
          <CollapsibleSection title="TRANSFORM (MM)">
            <div className="space-y-2">
              <TripleRow
                label="Anchor offset (from connector center)"
                value={port.anchorMm}
                onCommit={(anchorMm) => update({ anchorMm })}
              />
              <Row label="Roll (°)">
                <NumField
                  value={port.rotationDeg[2]}
                  step={5}
                  onCommit={(v) =>
                    update({
                      rotationDeg: [port.rotationDeg[0], port.rotationDeg[1], v],
                    })
                  }
                />
              </Row>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="CABLE SETTINGS">
            <div className="space-y-2">
              <Row label="Insertion">
                <NumField
                  value={port.insertionMm ?? 13}
                  suffix="mm"
                  onCommit={(v) =>
                    update({ insertionMm: Math.max(0, Math.min(40, v)) })
                  }
                />
              </Row>
              <Row label="Exit">
                <select
                  value={presetOf(port)}
                  onChange={(e) => {
                    const preset = e.target.value as ExitPreset;
                    if (preset === 'custom') return;
                    const base = EXIT_PRESETS[preset];
                    const out = port.location === 'front' ? 1 : -1;
                    update({
                      exitDirMm: base
                        ? [base[0], base[1], base[2] * out]
                        : undefined,
                    });
                  }}
                  className={inputClass}
                >
                  <option value="straight">Straight out</option>
                  <option value="up">Angled up</option>
                  <option value="down">Angled down</option>
                  <option value="left">Angled left</option>
                  <option value="right">Angled right</option>
                  <option value="custom">Custom vector</option>
                </select>
              </Row>
              {presetOf(port) === 'custom' && port.exitDirMm && (
                <TripleRow
                  label="Exit direction (vector)"
                  value={port.exitDirMm}
                  onCommit={(exitDirMm) => update({ exitDirMm })}
                />
              )}
              <Row label="Bend radius">
                <NumField
                  value={port.bendRadiusMm ?? 18}
                  suffix="mm"
                  onCommit={(v) =>
                    update({ bendRadiusMm: Math.max(1, Math.min(200, v)) })
                  }
                />
              </Row>
              <p className="text-[10px] leading-relaxed text-muted">
                The anchor is where the plug body ends and the sheath
                begins. Selected ports preview the plugged connector, the
                exit arrow and the anchor point live in the viewport — the
                cable renderer uses exactly these values.
              </p>
            </div>
          </CollapsibleSection>
        </>
      )}
    </>
  );
}

/* ---- LEDs ------------------------------------------------------------- */

function LedSections() {
  const leds = useAuthoringStore((s) => s.leds);
  const selectedLedId = useAuthoringStore((s) => s.selectedLedId);
  const updateLed = useAuthoringStore((s) => s.updateLed);
  const renameLed = useAuthoringStore((s) => s.renameLed);
  const deleteLed = useAuthoringStore((s) => s.deleteLed);

  const led = leds.find((l) => l.id === selectedLedId) ?? null;
  if (!led) {
    return emptyState(
      leds.length === 0
        ? 'No LEDs authored yet — add one from the left panel.'
        : 'Select an LED in the viewport or the list below.',
    );
  }

  return (
    <>
      <CollapsibleSection title="GENERAL">
        <div className="space-y-2">
          <Row label="ID">
            <IdField id={led.id} onRename={(next) => renameLed(led.id, next)} />
          </Row>
          <Row label="Label">
            <input
              value={led.label}
              onChange={(e) => updateLed(led.id, { label: e.target.value })}
              className={inputClass}
            />
          </Row>
          <Row label="Role">
            <select
              value={led.kind}
              onChange={(e) =>
                updateLed(led.id, { kind: e.target.value as LedKind })
              }
              className={inputClass}
            >
              {LED_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Color">
            <input
              type="color"
              value={led.color}
              onChange={(e) => updateLed(led.id, { color: e.target.value })}
              className="h-6 w-full cursor-pointer rounded-md border border-edge bg-background/40"
            />
          </Row>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="TRANSFORM (MM)">
        <div className="space-y-2">
          <TripleRow
            label="Position"
            value={led.positionMm}
            onCommit={(positionMm) => updateLed(led.id, { positionMm })}
          />
          <Row label="Diameter">
            <NumField
              value={led.diameterMm}
              suffix="mm"
              onCommit={(v) => updateLed(led.id, { diameterMm: Math.max(0.5, v) })}
            />
          </Row>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="APPEARANCE">
        <div className="space-y-2.5">
          <Slider
            label="Emissive intensity"
            value={led.intensity}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(intensity) => updateLed(led.id, { intensity })}
            format={(v) => v.toFixed(1)}
          />
          <SwitchRow
            label="On"
            checked={led.on}
            onChange={(on) => updateLed(led.id, { on })}
          />
          <button
            type="button"
            onClick={() => deleteLed(led.id)}
            className="h-6 w-full rounded-md text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
          >
            Delete LED
          </button>
        </div>
      </CollapsibleSection>
    </>
  );
}

/* ---- displays --------------------------------------------------------- */

function DisplaySections() {
  const display = useAuthoringStore((s) => s.display);
  const updateDisplay = useAuthoringStore((s) => s.updateDisplay);
  const deviceId = useAuthoringStore((s) => s.deviceId);

  if (!display?.lcd) {
    return emptyState(
      'This device has no display. Enable one from the left panel to author its glass, bezel and position.',
    );
  }
  const position = (display.positionMm ?? [0, 0, 0]) as Vec3;

  return (
    <>
      <CollapsibleSection title="DISPLAY">
        <div className="space-y-2">
          <SwitchRow
            label="Touchscreen"
            checked={display.touchscreen ?? false}
            onChange={(touchscreen) => updateDisplay({ touchscreen })}
          />
          <Row label="State">
            <select
              value={display.state ?? 'off'}
              onChange={(e) =>
                updateDisplay({ state: e.target.value as 'off' | 'placeholder' })
              }
              className={inputClass}
            >
              <option value="off">Powered off</option>
              <option value="placeholder">Placeholder glow</option>
            </select>
          </Row>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="BOUNDS (MM)">
        <div className="space-y-2">
          <TripleRow
            label="Position"
            value={position}
            onCommit={(positionMm) => updateDisplay({ positionMm })}
          />
          <div className="grid grid-cols-2 gap-1">
            <Row label="Width">
              <NumField
                value={display.widthMm ?? 60}
                suffix="mm"
                onCommit={(v) => updateDisplay({ widthMm: Math.max(5, v) })}
              />
            </Row>
            <Row label="Height">
              <NumField
                value={display.heightMm ?? 25}
                suffix="mm"
                onCommit={(v) => updateDisplay({ heightMm: Math.max(5, v) })}
              />
            </Row>
          </div>
          <Row label="Bezel">
            <NumField
              value={display.bezelMm ?? 2}
              suffix="mm"
              onCommit={(v) => updateDisplay({ bezelMm: Math.max(0, v) })}
            />
          </Row>
          <div className="grid grid-cols-2 gap-1">
            <Row label="Res X">
              <NumField
                value={display.resolution?.[0] ?? 240}
                step={1}
                onCommit={(v) =>
                  updateDisplay({
                    resolution: [Math.max(16, Math.round(v)), display.resolution?.[1] ?? 240],
                  })
                }
              />
            </Row>
            <Row label="Res Y">
              <NumField
                value={display.resolution?.[1] ?? 240}
                step={1}
                onCommit={(v) =>
                  updateDisplay({
                    resolution: [display.resolution?.[0] ?? 240, Math.max(16, Math.round(v))],
                  })
                }
              />
            </Row>
          </div>
          <p className="text-[10px] leading-relaxed text-muted">
            Device {deviceId}: the glass renders live in the viewport;
            a future runtime can drive its content dynamically.
          </p>
        </div>
      </CollapsibleSection>
    </>
  );
}

/* ---- cooling ---------------------------------------------------------- */

function CoolingSections() {
  const cooling = useAuthoringStore((s) => s.cooling);
  const selectedFan = useAuthoringStore((s) => s.selectedFan);
  const updateCooling = useAuthoringStore((s) => s.updateCooling);
  const moveFan = useAuthoringStore((s) => s.moveFan);
  const deleteFan = useAuthoringStore((s) => s.deleteFan);

  const fans = cooling?.fanPositionsMm ?? [];
  const fan = selectedFan !== null ? fans[selectedFan] : undefined;

  return (
    <>
      <CollapsibleSection title="COOLING">
        <div className="space-y-2">
          <Row label="Fan Ø">
            <NumField
              value={cooling?.fanDiameterMm ?? 40}
              suffix="mm"
              onCommit={(v) => updateCooling({ fanDiameterMm: Math.max(10, v) })}
            />
          </Row>
          <Row label="Airflow">
            <select
              value={cooling?.airflow ?? 'front-to-rear'}
              onChange={(e) =>
                updateCooling({
                  airflow: e.target.value as NonNullable<
                    NonNullable<typeof cooling>['airflow']
                  >,
                })
              }
              className={inputClass}
            >
              <option value="front-to-rear">Front → rear</option>
              <option value="rear-to-front">Rear → front</option>
              <option value="side-to-side">Side → side</option>
              <option value="passive">Passive</option>
            </select>
          </Row>
          <p className="text-[10px] leading-relaxed text-muted">
            {fans.length} fan{fans.length === 1 ? '' : 's'} authored. Add
            fans from the left panel; select one in the list below to
            position it.
          </p>
        </div>
      </CollapsibleSection>

      {fan && selectedFan !== null && (
        <CollapsibleSection title={`FAN ${selectedFan + 1} (MM)`}>
          <div className="space-y-2">
            <TripleRow
              label="Position"
              value={fan as Vec3}
              onCommit={(positionMm) => moveFan(selectedFan, positionMm)}
            />
            <button
              type="button"
              onClick={() => deleteFan(selectedFan)}
              className="h-6 w-full rounded-md text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
            >
              Delete fan
            </button>
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

/* ---- validation ------------------------------------------------------- */

function ValidationSections() {
  const { counts } = useValidation();
  return (
    <CollapsibleSection title="VALIDATION">
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-secondary">Errors</span>
          <span className={counts.errors ? 'font-semibold text-danger' : 'text-muted'}>
            {counts.errors}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">Warnings</span>
          <span className={counts.warnings ? 'font-semibold text-warning' : 'text-muted'}>
            {counts.warnings}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">Suggestions</span>
          <span className="text-muted">{counts.infos}</span>
        </div>
        <p className="pt-1 leading-relaxed text-muted">
          The full issue list is in the panel below — click an issue to
          select the offending object. Validation runs live on every
          edit.
        </p>
      </div>
    </CollapsibleSection>
  );
}

/* ---- mount (device-level) --------------------------------------------- */

function DeviceMountSections() {
  const mountOffsetMm = useAuthoringStore((s) => s.mountOffsetMm);
  const setMountOffset = useAuthoringStore((s) => s.setMountOffset);
  const modelTransform = useAuthoringStore((s) => s.modelTransform);
  const setModelTransform = useAuthoringStore((s) => s.setModelTransform);
  const mountPreview = useAuthoringStore((s) => s.mountPreview);
  const toggleMountPreview = useAuthoringStore((s) => s.toggleMountPreview);

  return (
    <>
      <CollapsibleSection title="MOUNT ALIGNMENT">
        <div className="space-y-2">
          <SwitchRow
            label="Mount preview (real rails)"
            checked={mountPreview}
            onChange={toggleMountPreview}
          />
          <TripleRow
            label="Mount offset (mm)"
            value={mountOffsetMm}
            onCommit={setMountOffset}
          />
          <button
            type="button"
            onClick={() => setMountOffset([0, 0, 0])}
            className="h-6 w-full rounded-md border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover"
          >
            Reset mount offset
          </button>
          <p className="text-[10px] leading-relaxed text-muted">
            Correction applied by the placement engine on top of the
            rail-flush position: X lateral, Y vertical, Z toward the
            faceplate. Use it when the model's ears or holes don't land
            exactly on the rails.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="MODEL CORRECTION" defaultOpen={false}>
        <div className="space-y-2">
          {modelTransform ? (
            <>
              <TripleRow
                label="Model offset (mm)"
                value={modelTransform.offsetMm as Vec3}
                onCommit={(offsetMm) =>
                  setModelTransform({ ...modelTransform, offsetMm })
                }
              />
              <TripleRow
                label="Model rotation (°)"
                value={modelTransform.rotationDeg as Vec3}
                onCommit={(rotationDeg) =>
                  setModelTransform({ ...modelTransform, rotationDeg })
                }
              />
              <Row label="Scale">
                <NumField
                  value={
                    typeof modelTransform.scale === 'number'
                      ? modelTransform.scale
                      : 1
                  }
                  step={0.001}
                  onCommit={(scale) =>
                    setModelTransform({
                      ...modelTransform,
                      scale: Math.max(0.001, scale),
                    })
                  }
                />
              </Row>
              <button
                type="button"
                onClick={() => setModelTransform(undefined)}
                className="h-6 w-full rounded-md border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover"
              >
                Reset to automatic import transform
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] leading-relaxed text-muted">
                The universal importer currently positions this model
                automatically. Take manual control to fine-tune how the
                GLB sits inside the device box.
              </p>
              <button
                type="button"
                onClick={() => {
                  const deviceId = useAuthoringStore.getState().deviceId;
                  const report = deviceId
                    ? useImportReportStore.getState().reports[deviceId]
                    : undefined;
                  setModelTransform(
                    report
                      ? {
                          scale: report.transform.scale,
                          rotationDeg: [...report.transform.rotationDeg] as Vec3,
                          offsetMm: [...report.transform.offsetMm] as Vec3,
                        }
                      : { scale: 1, rotationDeg: [0, 0, 0], offsetMm: [0, 0, 0] },
                  );
                }}
                className="h-6 w-full rounded-md border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover"
              >
                Edit model transform manually…
              </button>
            </>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}

/* ---- composition ------------------------------------------------------ */

const TITLES: Record<string, string> = {
  mount: 'Mount Inspector',
  ports: 'Port Inspector',
  anchors: 'Cable Anchor Inspector',
  power: 'Power Inspector',
  leds: 'LED Inspector',
  displays: 'Display Inspector',
  cooling: 'Cooling Inspector',
  validation: 'Validation',
};

export function PortInspectorPanel() {
  const category = useAuthoringStore((s) => s.category);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-edge bg-surface">
      <PanelHeader title={TITLES[category] ?? 'Inspector'} />
      {category === 'mount' && <DeviceMountSections />}
      {(category === 'ports' || category === 'power') && <PortSections />}
      {category === 'anchors' && <AnchorSections />}
      {category === 'leds' && <LedSections />}
      {category === 'displays' && <DisplaySections />}
      {category === 'cooling' && <CoolingSections />}
      {category === 'validation' && <ValidationSections />}
    </aside>
  );
}
