import { motion } from 'framer-motion';
import { Box, Focus, RotateCcw } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useViewportStore } from '@/stores/viewportStore';
import { cn } from '@/lib/utils';
import type { ViewPreset } from '@/types';

const ORTHO_VIEWS: ReadonlyArray<{ id: ViewPreset; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

/**
 * Floating camera navigation widget (top-right of the viewport):
 * perspective + face views, fit and reset — all animated transitions.
 */
export function ViewportNavWidget() {
  const activeView = useViewportStore((s) => s.activeView);
  const dispatchCamera = useViewportStore((s) => s.dispatchCamera);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.3, ease: 'easeOut' }}
      className="glass-panel absolute top-3 right-3 w-[148px] rounded-xl p-1.5 shadow-overlay"
    >
      {/* Perspective */}
      <button
        type="button"
        onClick={() => dispatchCamera({ type: 'preset', view: 'perspective' })}
        className={cn(
          'flex h-7 w-full items-center gap-2 rounded-lg px-2 transition-colors duration-100',
          activeView === 'perspective'
            ? 'bg-accent-soft text-accent'
            : 'text-secondary hover:bg-surface-hover hover:text-primary',
        )}
      >
        <Box className="size-3.5" strokeWidth={1.75} />
        <span className="text-[11px] font-medium">Perspective</span>
      </button>

      {/* Face views */}
      <div className="mt-1 grid grid-cols-3 gap-0.5">
        {ORTHO_VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => dispatchCamera({ type: 'preset', view: id })}
            className={cn(
              'h-6 rounded-md text-[10px] font-medium transition-colors duration-100',
              activeView === id
                ? 'bg-accent-soft text-accent'
                : 'text-secondary hover:bg-surface-hover hover:text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="my-1.5 h-px bg-edge" aria-hidden />

      {/* Actions */}
      <div className="flex gap-0.5">
        <Tooltip label="Fit view">
          <button
            type="button"
            aria-label="Fit view"
            onClick={() => dispatchCamera({ type: 'fit' })}
            className="flex h-6 flex-1 items-center justify-center rounded-md text-secondary transition-colors duration-100 hover:bg-surface-hover hover:text-primary"
          >
            <Focus className="size-3.5" strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip label="Reset camera">
          <button
            type="button"
            aria-label="Reset camera"
            onClick={() => dispatchCamera({ type: 'reset' })}
            className="flex h-6 flex-1 items-center justify-center rounded-md text-secondary transition-colors duration-100 hover:bg-surface-hover hover:text-primary"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}
