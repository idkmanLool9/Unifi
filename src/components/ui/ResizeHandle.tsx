import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  /** Which edge of the panel this handle sits on. */
  edge: 'left' | 'right';
  value: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  /** Reset target for double-click. */
  defaultValue: number;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  label: string;
}

const KEYBOARD_STEP = 12;

/**
 * Slim panel-resize handle: 6px grab zone with an accent line on hover and
 * while dragging. Double-click resets; arrow keys resize for keyboard use.
 */
export function ResizeHandle({
  edge,
  value,
  min,
  max,
  onChange,
  defaultValue,
  onResizeStart,
  onResizeEnd,
  label,
}: ResizeHandleProps) {
  const start = useRef<{ x: number; value: number } | null>(null);
  // Dragging the sidebar's right edge rightward grows it; dragging the
  // inspector's left edge rightward shrinks it.
  const sign = edge === 'right' ? 1 : -1;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, value };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onResizeStart?.();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    onChange(start.current.value + sign * (e.clientX - start.current.x));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onResizeEnd?.();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange(value - sign * KEYBOARD_STEP);
        if (e.key === 'ArrowRight') onChange(value + sign * KEYBOARD_STEP);
      }}
      className={cn(
        'group absolute inset-y-0 z-20 w-[6px] cursor-col-resize touch-none',
        edge === 'right' ? '-right-[3px]' : '-left-[3px]',
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 w-[2px] rounded-full transition-colors duration-100',
          edge === 'right' ? 'right-[2px]' : 'left-[2px]',
          'group-hover:bg-accent/50 group-focus-visible:bg-accent group-active:bg-accent',
        )}
      />
    </div>
  );
}
