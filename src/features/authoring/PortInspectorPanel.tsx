import { useEffect, useState } from 'react';
import {
  primaryPort,
  selectedPorts,
  useAuthoringStore,
} from './authoringStore';
import { round2, type AuthoredPort, type Vec3 } from './authoringModel';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { PORT_TYPES, type PortType } from '@/features/devices/deviceSchema';

/**
 * The Port Inspector: every property of the primary selected port —
 * identity, transform in device millimeters, electrical properties,
 * preview visuals and the cable anchor. All fields write straight into
 * the authoring store; nothing here is decorative.
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

export function PortInspectorPanel() {
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

  const update = (patch: Partial<AuthoredPort>) => {
    if (port) updatePort(port.id, patch);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-edge bg-surface">
      <PanelHeader title="Port Inspector" />

      {!port ? (
        <div className="px-4 py-6 text-center text-xs leading-relaxed text-muted">
          Select a port in the viewport or the layout strip below.
          <br />
          Shift-click adds to the selection.
        </div>
      ) : (
        <>
          {selected.length > 1 && (
            <div className="border-b border-edge bg-accent/8 px-3 py-2 text-[11px] text-secondary">
              {selected.length} ports selected — editing{' '}
              <span className="font-medium text-primary">{port.id}</span>
            </div>
          )}

          <CollapsibleSection title="PORT">
            <div className="space-y-2">
              <Row label="Port Type">
                <select
                  value={port.type}
                  onChange={(e) => {
                    update({ type: e.target.value as PortType });
                  }}
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
                  onChange={(e) =>
                    update({ label: e.target.value || undefined })
                  }
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
                    onCommit={(v) =>
                      update({ sizeMm: [Math.max(2, v), port.sizeMm[1]] })
                    }
                    suffix="mm"
                  />
                  <NumField
                    value={port.sizeMm[1]}
                    onCommit={(v) =>
                      update({ sizeMm: [port.sizeMm[0], Math.max(2, v)] })
                    }
                    suffix="mm"
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="PORT PROPERTIES">
            <div className="space-y-2">
              <Row label="Side">
                <select
                  value={port.location}
                  onChange={(e) => {
                    const location = e.target.value as 'front' | 'rear';
                    // Flip the connector (and its anchor) to the other panel.
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
              <Row label="Row">
                <NumField
                  value={port.row ?? 0}
                  step={1}
                  onCommit={(v) =>
                    update({ row: v > 0 ? Math.round(v) : undefined })
                  }
                />
              </Row>
              <Row label="Speed">
                <select
                  value={port.speedGbps?.toString() ?? ''}
                  onChange={(e) =>
                    update({
                      speedGbps: e.target.value
                        ? Number(e.target.value)
                        : undefined,
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
                    onCommit={(v) =>
                      update({ poeBudgetW: v > 0 ? v : undefined })
                    }
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

          <CollapsibleSection title="VISUAL">
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

          <CollapsibleSection title="ANCHOR" defaultOpen={false}>
            <div className="space-y-2">
              <TripleRow
                label="Cable anchor offset"
                value={port.anchorMm}
                onCommit={(anchorMm) => update({ anchorMm })}
              />
              <p className="text-[10px] leading-relaxed text-muted">
                Offset from the connector center, mm. Cables exit toward{' '}
                {port.location === 'front' ? '+Z (front)' : '−Z (rear)'}; the
                anchor is where the plug body ends.
              </p>
            </div>
          </CollapsibleSection>
        </>
      )}
    </aside>
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
