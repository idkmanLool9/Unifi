import type { ReactNode } from 'react';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/constants';

function fpsColor(fps: number): string {
  if (fps >= 50) return 'text-success';
  if (fps >= 30) return 'text-warning';
  return 'text-danger';
}

const numberFormat = new Intl.NumberFormat('en-US');

/** Read-only status field: "Label Value". */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-secondary">{children}</span>
    </span>
  );
}

/** Clickable status chip that toggles a boolean setting. */
function ToggleChip({
  label,
  on,
  onClick,
  title,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-[18px] items-center gap-1 rounded-[5px] px-1.5 transition-colors duration-100',
        'hover:bg-surface-hover',
        on ? 'text-accent' : 'text-muted',
      )}
    >
      <span
        className={cn(
          'size-1 rounded-full',
          on ? 'bg-accent' : 'bg-edge-strong',
        )}
      />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-edge" aria-hidden />;
}

export function StatusBar() {
  const fps = useViewportStore((s) => s.fps);
  const triangles = useViewportStore((s) => s.triangles);
  const drawCalls = useViewportStore((s) => s.drawCalls);
  const activeView = useViewportStore((s) => s.activeView);

  const gridVisible = useViewSettingsStore((s) => s.gridVisible);
  const snapEnabled = useViewSettingsStore((s) => s.snapEnabled);
  const toggleGrid = useViewSettingsStore((s) => s.toggleGrid);
  const toggleSnap = useViewSettingsStore((s) => s.toggleSnap);

  return (
    <footer className="flex h-[26px] shrink-0 items-center justify-between border-t border-edge bg-surface px-2.5 text-[11px] text-secondary select-none">
      {/* Left: project + editor state */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          <span className="font-medium">Ready</span>
        </span>
        <Divider />
        <Field label="Selection">None</Field>
        <Divider />
        <Field label="Mode">Design</Field>
        <Divider />
        <Field label="Project">Draft</Field>
      </div>

      {/* Right: workspace settings + render stats */}
      <div className="flex items-center gap-2 tabular-nums">
        <Field label="Units">Metric</Field>
        <Divider />
        <ToggleChip
          label="Grid"
          on={gridVisible}
          onClick={toggleGrid}
          title="Toggle floor grid"
        />
        <ToggleChip
          label="Snap"
          on={snapEnabled}
          onClick={toggleSnap}
          title="Toggle snapping"
        />
        <Divider />
        <Field label="Camera">
          <span className="capitalize">{activeView}</span>
        </Field>
        <Divider />
        <span title="Draw calls / triangles" className="text-muted">
          {drawCalls} calls · {numberFormat.format(triangles)} tris
        </span>
        <span title="Frames per second" className="flex items-center gap-1">
          <span className={cn('font-semibold', fpsColor(fps))}>
            {fps > 0 ? fps : '—'}
          </span>
          <span className="text-muted">fps</span>
        </span>
        <Divider />
        <span className="text-muted">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
