import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import {
  detectPitchMm,
  type ArrayDirection,
  type AuthoredPort,
} from './authoringModel';
import { primaryPort, useAuthoringStore } from './authoringStore';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tooltip } from '@/components/ui/Tooltip';
import { getDevice } from '@/features/devices/deviceRegistry';
import { CONNECTOR_SIZES } from '@/features/devices/hardware/physicalPorts';
import { cn } from '@/lib/utils';

/**
 * Bottom strip: a true-scale 2D map of the authored faceplate (every
 * port clickable, shift for multi-select) plus the Array / Duplicate
 * bulk tools. The map is an SVG projection of device-local mm — the
 * same numbers the inspector shows.
 */

const STRIP_HEIGHT = 96;

function LayoutMap({ face }: { face: 'front' | 'rear' }) {
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const ports = useAuthoringStore((s) => s.ports);
  const selection = useAuthoringStore((s) => s.selection);
  const select = useAuthoringStore((s) => s.select);
  const definition = deviceId ? getDevice(deviceId) : undefined;

  const visible = ports.filter((p) => p.location === face);
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
        {/* Faceplate outline */}
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
          // SVG y grows downward; device y grows upward.
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
                  : 'fill-accent/20 stroke-accent/50 hover:fill-accent/40',
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

export function PortLayoutStrip() {
  const ports = useAuthoringStore((s) => s.ports);
  const selectMany = useAuthoringStore((s) => s.selectMany);
  const dispatchCamera = useAuthoringStore((s) => s.dispatchCamera);
  const [face, setFace] = useState<'front' | 'rear'>('front');

  const facePorts = (f: 'front' | 'rear') =>
    ports.filter((p: AuthoredPort) => p.location === f);

  return (
    <div className="flex shrink-0 border-t border-edge bg-surface">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-edge px-3">
          <span className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
            Port Layout
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
          <LayoutMap face={face} />
        </div>
      </div>
      <ArrayPanel />
    </div>
  );
}
