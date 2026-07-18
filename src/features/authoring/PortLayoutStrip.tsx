import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleDot,
  Fan,
  Info,
  OctagonX,
  Search,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import {
  detectPitchMm,
  type ArrayDirection,
  type AuthoredPort,
} from './authoringModel';
import {
  isPowerType,
  primaryPort,
  useAuthoringStore,
} from './authoringStore';
import { useValidation } from './useValidation';
import type { ValidationIssue } from './validation';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tooltip } from '@/components/ui/Tooltip';
import { getDevice } from '@/features/devices/deviceRegistry';
import { CONNECTOR_SIZES } from '@/features/devices/hardware/physicalPorts';
import { cn } from '@/lib/utils';

/**
 * Bottom context panel — content follows the active category. Port
 * categories get the true-scale faceplate map with search + array
 * tools; LEDs / cooling get their object lists; validation gets the
 * live issue list with jump-to-selection.
 */

const STRIP_HEIGHT = 96;

function LayoutMap({
  face,
  power,
  query,
}: {
  face: 'front' | 'rear';
  power: boolean;
  query: string;
}) {
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const select = useAuthoringStore((s) => s.select);
  const definition = deviceId ? getDevice(deviceId) : undefined;

  const q = query.trim().toLowerCase();
  const matches = (port: AuthoredPort) =>
    q.length === 0 ||
    port.id.toLowerCase().includes(q) ||
    (port.label ?? '').toLowerCase().includes(q) ||
    port.type.includes(q);

  const visible = ports.filter(
    (p) => p.location === face && isPowerType(p.type) === power,
  );
  if (!definition) return null;

  const w = definition.widthMm;
  const h = Math.max(definition.heightMm, 30);
  const pad = 6;

  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <svg
        data-testid="port-layout-map"
        viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}`}
        style={{ height: STRIP_HEIGHT }}
        className="mx-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={2}
          className="fill-surface-raised stroke-edge"
          strokeWidth={0.6}
        />
        {visible.map((port) => {
          const selected = selection.includes(port.id);
          const hit = matches(port);
          const x = port.positionMm[0] - port.sizeMm[0] / 2;
          const y = -port.positionMm[1] - port.sizeMm[1] / 2;
          return (
            <rect
              key={port.id}
              x={x}
              y={y}
              width={port.sizeMm[0]}
              height={port.sizeMm[1]}
              rx={1}
              onClick={(e) => select(port.id, e.shiftKey)}
              className={cn(
                'cursor-pointer transition-colors duration-100',
                selected
                  ? 'fill-accent/70 stroke-accent'
                  : hit
                    ? 'fill-accent/20 stroke-accent/50 hover:fill-accent/40'
                    : 'fill-surface-active/40 stroke-edge',
              )}
              strokeWidth={0.5}
            >
              <title>{port.id}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

const DIRECTIONS: ReadonlyArray<{
  id: ArrayDirection;
  icon: LucideIcon;
  label: string;
}> = [
  { id: '+x', icon: ArrowRight, label: 'Array right (+X)' },
  { id: '-x', icon: ArrowLeft, label: 'Array left (−X)' },
  { id: '+y', icon: ArrowUp, label: 'Array up (+Y)' },
  { id: '-y', icon: ArrowDown, label: 'Array down (−Y)' },
];

function ArrayPanel() {
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const applyArray = useAuthoringStore((s) => s.applyArray);
  const duplicateSelection = useAuthoringStore((s) => s.duplicateSelection);
  const primary = primaryPort({ ports, selection });

  const [arrayMode, setArrayMode] = useState<'duplicate' | 'array'>('array');
  const [count, setCount] = useState(1);
  const [direction, setDirection] = useState<ArrayDirection>('+x');
  const defaultSpacing = primary
    ? CONNECTOR_SIZES[primary.type].pitchMm
    : 17.9;
  const [spacing, setSpacing] = useState<number | null>(null);
  const effectiveSpacing = spacing ?? defaultSpacing;

  const detected = useMemo(
    () => (primary ? detectPitchMm(ports, primary.type, primary.location) : null),
    [ports, primary],
  );

  const apply = () => {
    if (!primary) return;
    if (arrayMode === 'duplicate') duplicateSelection();
    else applyArray(count, effectiveSpacing, direction);
  };

  const fieldClass =
    'h-6 w-full rounded-md border border-edge bg-background/40 px-1.5 text-[11px] text-primary tabular-nums outline-none focus:border-accent/60';

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 border-l border-edge px-3 py-2">
      <div className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
        Array / Duplicate
      </div>
      <SegmentedControl
        value={arrayMode}
        onChange={setArrayMode}
        label="Bulk mode"
        options={[
          { value: 'duplicate', label: 'Duplicate' },
          { value: 'array', label: 'Array' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted">Count</span>
          <input
            id="authoring-array-count"
            type="number"
            min={1}
            max={96}
            value={count}
            disabled={arrayMode === 'duplicate'}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(96, Number(e.target.value) || 1)))
            }
            className={cn(fieldClass, arrayMode === 'duplicate' && 'opacity-40')}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-muted">Spacing (mm)</span>
          <div className="flex gap-1">
            <input
              type="number"
              step={0.1}
              value={effectiveSpacing}
              onChange={(e) => setSpacing(Number(e.target.value) || 0)}
              className={fieldClass}
            />
            <Tooltip
              label={
                detected
                  ? `Fit to existing spacing (${detected} mm)`
                  : 'No repeated spacing detected'
              }
            >
              <button
                type="button"
                disabled={!detected}
                onClick={() => detected && setSpacing(detected)}
                className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-edge text-muted transition-colors hover:bg-surface-hover hover:text-accent disabled:opacity-40"
              >
                <Wand2 className="size-3.5" strokeWidth={1.8} />
              </button>
            </Tooltip>
          </div>
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-lg border border-edge bg-background/40 p-0.5">
          {DIRECTIONS.map(({ id, icon: Icon, label }) => (
            <Tooltip key={id} label={label}>
              <button
                type="button"
                aria-pressed={direction === id}
                disabled={arrayMode === 'duplicate'}
                onClick={() => setDirection(id)}
                className={cn(
                  'flex size-6 items-center justify-center rounded-md transition-colors',
                  direction === id
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:text-secondary',
                  arrayMode === 'duplicate' && 'opacity-40',
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.8} />
              </button>
            </Tooltip>
          ))}
        </div>
        <button
          type="button"
          disabled={!primary}
          onClick={apply}
          className="h-6 flex-1 rounded-md bg-accent text-[11px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/* ---- port categories --------------------------------------------------- */

function PortsContext({ power }: { power: boolean }) {
  const ports = useAuthoringStore((s) => s.ports);
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const selectMany = useAuthoringStore((s) => s.selectMany);
  const dispatchCamera = useAuthoringStore((s) => s.dispatchCamera);
  const [query, setQuery] = useState('');

  const facePorts = (f: 'front' | 'rear') =>
    ports.filter((p) => p.location === f && isPowerType(p.type) === power);

  // Open on the face that actually has ports (rear-ported devices like
  // desktop gateways otherwise greet the author with an empty front).
  const populated: 'front' | 'rear' =
    facePorts('front').length === 0 && facePorts('rear').length > 0
      ? 'rear'
      : power
        ? 'rear'
        : 'front';
  const [face, setFaceState] = useState<'front' | 'rear'>(populated);
  const [faceDevice, setFaceDevice] = useState(deviceId);
  if (faceDevice !== deviceId) {
    // New device opened: re-derive the default face.
    setFaceDevice(deviceId);
    setFaceState(populated);
  }
  const setFace = (f: 'front' | 'rear') => {
    setFaceState(f);
    // Switching face swings the camera to that panel.
    dispatchCamera({ type: 'frame-ports', face: f });
  };

  const q = query.trim().toLowerCase();
  const matched = facePorts(face).filter(
    (p) =>
      q.length === 0 ||
      p.id.toLowerCase().includes(q) ||
      (p.label ?? '').toLowerCase().includes(q) ||
      p.type.includes(q),
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-edge px-3">
        <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
          {power ? 'Power Layout' : 'Port Layout'}
        </span>
        <div className="w-36">
          <SegmentedControl
            value={face}
            onChange={setFace}
            label="Layout face"
            options={[
              { value: 'front', label: `Front · ${facePorts('front').length}` },
              { value: 'rear', label: `Rear · ${facePorts('rear').length}` },
            ]}
          />
        </div>
        <div className="relative w-44">
          <Search className="pointer-events-none absolute top-1/2 left-1.5 size-3 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matched.length > 0) {
                selectMany(matched.map((p) => p.id));
              }
            }}
            placeholder="Search… (Enter selects)"
            className="h-6 w-full rounded-md border border-edge bg-background/40 pr-1.5 pl-6 text-[11px] text-primary outline-none focus:border-accent/60"
          />
        </div>
        <button
          type="button"
          onClick={() => dispatchCamera({ type: 'frame-ports', face })}
          className="h-6 rounded-md border border-edge px-2 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
        >
          Fit to Ports
        </button>
        <button
          type="button"
          onClick={() => selectMany(facePorts(face).map((p) => p.id))}
          className="h-6 rounded-md border border-edge px-2 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
        >
          Select All
        </button>
      </div>
      <div className="flex items-center px-3 py-1.5">
        <LayoutMap face={face} power={power} query={query} />
      </div>
    </div>
  );
}

/* ---- LEDs / cooling lists ---------------------------------------------- */

function Chip({
  label,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors',
        active
          ? 'border-accent/60 bg-accent/12 text-accent'
          : 'border-edge text-secondary hover:bg-surface-hover hover:text-primary',
      )}
    >
      {color && (
        <span
          className="size-2.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      {Icon && <Icon className="size-3.5" strokeWidth={1.8} />}
      {label}
    </button>
  );
}

function LedContext() {
  const leds = useAuthoringStore((s) => s.leds);
  const selectedLedId = useAuthoringStore((s) => s.selectedLedId);
  const selectLed = useAuthoringStore((s) => s.selectLed);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-2 border-b border-edge px-3">
        <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
          LEDs · {leds.length}
        </span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-3">
        {leds.length === 0 && (
          <span className="text-[11px] text-muted">
            No LEDs authored — add one from the left panel.
          </span>
        )}
        {leds.map((led) => (
          <Chip
            key={led.id}
            label={`${led.label} · ${led.kind}`}
            color={led.color}
            active={selectedLedId === led.id}
            onClick={() => selectLed(selectedLedId === led.id ? null : led.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CoolingContext() {
  const cooling = useAuthoringStore((s) => s.cooling);
  const selectedFan = useAuthoringStore((s) => s.selectedFan);
  const selectFan = useAuthoringStore((s) => s.selectFan);
  const fans = cooling?.fanPositionsMm ?? [];
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-2 border-b border-edge px-3">
        <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
          Fans · {fans.length}
        </span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-3">
        {fans.length === 0 && (
          <span className="text-[11px] text-muted">
            No fans authored — add one from the left panel.
          </span>
        )}
        {fans.map((fan, i) => (
          <Chip
            key={i}
            icon={Fan}
            label={`Fan ${i + 1} · ${fan[0]}, ${fan[1]}, ${fan[2]}`}
            active={selectedFan === i}
            onClick={() => selectFan(selectedFan === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}

function DisplayContext() {
  const display = useAuthoringStore((s) => s.display);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-2 border-b border-edge px-3">
        <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
          Displays · {display?.lcd ? 1 : 0}
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-3">
        {display?.lcd ? (
          <Chip
            icon={CircleDot}
            label={`LCD · ${display.widthMm ?? 60} × ${display.heightMm ?? 25} mm`}
            active
            onClick={() => {}}
          />
        ) : (
          <span className="text-[11px] text-muted">
            No display — enable one from the left panel.
          </span>
        )}
      </div>
    </div>
  );
}

/* ---- validation --------------------------------------------------------- */

const LEVEL_META: Record<
  ValidationIssue['level'],
  { icon: LucideIcon; className: string }
> = {
  error: { icon: OctagonX, className: 'text-danger' },
  warning: { icon: AlertTriangle, className: 'text-warning' },
  info: { icon: Info, className: 'text-muted' },
};

function ValidationContext() {
  const { issues } = useValidation();
  const select = useAuthoringStore((s) => s.select);
  const selectLed = useAuthoringStore((s) => s.selectLed);
  const selectFan = useAuthoringStore((s) => s.selectFan);
  const setCategory = useAuthoringStore((s) => s.setCategory);

  const jump = (issue: ValidationIssue) => {
    switch (issue.target.kind) {
      case 'port':
        setCategory('ports');
        select(issue.target.id);
        break;
      case 'led':
        setCategory('leds');
        selectLed(issue.target.id);
        break;
      case 'fan':
        setCategory('cooling');
        selectFan(Number(issue.target.id));
        break;
      case 'display':
        setCategory('displays');
        break;
      default:
        setCategory('mount');
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-2 border-b border-edge px-3">
        <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
          Validation · {issues.length} issue{issues.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="max-h-28 overflow-y-auto px-2 py-1.5">
        {issues.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-success">
            Everything checks out — no issues found.
          </div>
        )}
        {issues.map((issue, i) => {
          const meta = LEVEL_META[issue.level];
          const Icon = meta.icon;
          return (
            <button
              key={`${issue.code}-${i}`}
              type="button"
              onClick={() => jump(issue)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <Icon className={cn('size-3.5 shrink-0', meta.className)} strokeWidth={1.8} />
              <span className="flex-1 truncate">{issue.message}</span>
              <span className="text-[10px] text-muted">{issue.code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MountContext() {
  const mountOffsetMm = useAuthoringStore((s) => s.mountOffsetMm);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 text-[11px] text-secondary">
      <span className="font-semibold tracking-widest uppercase">Mount</span>
      <span className="text-muted">
        Offset {mountOffsetMm[0]}, {mountOffsetMm[1]}, {mountOffsetMm[2]} mm —
        dial it in against the rail gauge in the viewport; every value saves
        into metadata and applies identically in the rack editor.
      </span>
    </div>
  );
}

export function PortLayoutStrip() {
  const category = useAuthoringStore((s) => s.category);
  const portCategory =
    category === 'ports' || category === 'anchors' || category === 'power';

  return (
    <div className="flex h-[136px] shrink-0 border-t border-edge bg-surface">
      {portCategory && <PortsContext power={category === 'power'} />}
      {portCategory && <ArrayPanel />}
      {category === 'leds' && <LedContext />}
      {category === 'cooling' && <CoolingContext />}
      {category === 'displays' && <DisplayContext />}
      {category === 'validation' && <ValidationContext />}
      {category === 'mount' && <MountContext />}
    </div>
  );
}
