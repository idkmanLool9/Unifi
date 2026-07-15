import { useViewportStore } from '@/stores/viewportStore';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/constants';

function fpsColor(fps: number): string {
  if (fps >= 50) return 'text-success';
  if (fps >= 30) return 'text-warning';
  return 'text-danger';
}

const numberFormat = new Intl.NumberFormat('en-US');

export function StatusBar() {
  const fps = useViewportStore((s) => s.fps);
  const triangles = useViewportStore((s) => s.triangles);
  const drawCalls = useViewportStore((s) => s.drawCalls);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-edge bg-surface px-3 text-[11px] text-secondary select-none">
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        <span>Ready</span>
      </div>

      <div className="flex items-center gap-4 tabular-nums">
        <span title="Draw calls">
          Calls <span className="text-primary">{drawCalls}</span>
        </span>
        <span title="Triangles rendered">
          Tris{' '}
          <span className="text-primary">{numberFormat.format(triangles)}</span>
        </span>
        <span title="Frames per second">
          FPS{' '}
          <span className={cn('font-medium', fpsColor(fps))}>
            {fps > 0 ? fps : '—'}
          </span>
        </span>
        <span className="text-muted">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
