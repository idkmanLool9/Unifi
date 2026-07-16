import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, MoveVertical } from 'lucide-react';
import { getDevice } from '@/features/devices/deviceRegistry';
import { useDragStore, type DragSource } from '@/stores/dragStore';
import { cn } from '@/lib/utils';

/** Pointer travel (px) before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 6;

/**
 * Arms a drag from a pointerdown: nothing happens for a plain click;
 * once the pointer travels past the threshold the drag begins and the
 * global controller takes over. Scrolling and clicks stay intact.
 */
export function armDrag(
  event: { clientX: number; clientY: number; button?: number },
  makeSource: () => DragSource | null,
  options: { suspendOrbit?: boolean } = {},
): void {
  if (event.button !== undefined && event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let armed = true;

  // A press on a draggable 3D object must not double as an orbit
  // gesture: pause the camera for this pointer, resume if it ends up
  // being a plain click.
  if (options.suspendOrbit) useDragStore.getState().setOrbitSuspended(true);

  const onMove = (e: PointerEvent) => {
    if (!armed) return;
    if (
      Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX
    ) {
      return;
    }
    cleanup();
    const source = makeSource();
    if (source) {
      // begin() takes over; drop/cancel reset orbit suspension with it.
      useDragStore.getState().begin(source, { x: e.clientX, y: e.clientY });
    } else if (options.suspendOrbit) {
      useDragStore.getState().setOrbitSuspended(false);
    }
  };
  const disarm = () => {
    cleanup();
    if (options.suspendOrbit) {
      useDragStore.getState().setOrbitSuspended(false);
    }
  };
  const cleanup = () => {
    armed = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', disarm);
    window.removeEventListener('pointercancel', disarm);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', disarm);
  window.addEventListener('pointercancel', disarm);
}

/**
 * Owns the active drag gesture: pointer tracking, drop on release,
 * Escape/blur cancellation, Shift precision snapping, and the polished
 * HTML drag chip. Mounted once in the editor. While a drag is active the
 * chip is the only DOM the interaction adds; placement math happens in
 * the 3D placement layer.
 */
export function DragController() {
  const phase = useDragStore((s) => s.phase);
  const dragging = phase === 'dragging';

  useEffect(() => {
    if (!dragging) return;
    const store = useDragStore.getState;

    const onPointerMove = (e: PointerEvent) =>
      store().movePointer(e.clientX, e.clientY);
    const onPointerUp = () => store().drop();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        store().cancel();
      } else if (e.key === 'Shift') {
        store().setPrecise(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') store().setPrecise(false);
    };
    const onBlur = () => store().cancel();

    // Capture phase so Escape beats the editor's layered dismiss chain.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onBlur);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onBlur);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [dragging]);

  return (
    <AnimatePresence>{dragging && <DragChip key="chip" />}</AnimatePresence>
  );
}

function DragChip() {
  const pointer = useDragStore((s) => s.pointer);
  const source = useDragStore((s) => s.source);
  const target = useDragStore((s) => s.target);
  const validation = useDragStore((s) => s.validation);

  const definition = source ? getDevice(source.definitionId) : undefined;
  if (!definition) return null;

  const shelfMounted = definition.mountingStandard !== 'eia-310';
  const endU = target ? target.startU + definition.rackUnits - 1 : 0;
  const range = target
    ? target.startU === endU
      ? `U${target.startU}`
      : `U${target.startU}–U${endU}`
    : null;

  const status: 'valid' | 'invalid' | 'neutral' =
    target === null ? 'neutral' : validation?.ok ? 'valid' : 'invalid';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none fixed z-[80]"
      style={{ left: pointer.x + 14, top: pointer.y + 16 }}
    >
      <div
        className={cn(
          'glass-panel w-56 rounded-[10px] border p-2.5 shadow-overlay',
          status === 'valid' && 'border-success/50',
          status === 'invalid' && 'border-danger/60',
          status === 'neutral' && 'border-edge',
        )}
      >
        <div className="flex items-center gap-1.5">
          {shelfMounted ? (
            <Archive className="size-3.5 shrink-0 text-secondary" strokeWidth={2} />
          ) : (
            <MoveVertical className="size-3.5 shrink-0 text-secondary" strokeWidth={2} />
          )}
          <p className="truncate text-[12px] font-medium text-primary">
            {definition.productName}
          </p>
          <span className="ml-auto shrink-0 rounded-[5px] bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent tabular-nums">
            {definition.rackUnits}U
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10.5px] text-muted">
          {definition.manufacturerName} ·{' '}
          {shelfMounted ? 'Shelf-mounted' : 'Rack-mounted'}
          {source?.kind === 'instance' && source.duplicate && ' · Duplicate'}
        </p>
        <div
          className={cn(
            'mt-1.5 rounded-md px-1.5 py-1 text-[10.5px] leading-snug font-medium',
            status === 'valid' && 'bg-success/10 text-success',
            status === 'invalid' && 'bg-danger/10 text-danger',
            status === 'neutral' && 'bg-surface-active text-muted',
          )}
        >
          {status === 'valid' &&
            `Place at ${range} · ${target?.facing === 'front' ? 'Front' : 'Rear'}`}
          {status === 'invalid' && (validation && !validation.ok ? validation.message : '')}
          {status === 'neutral' && 'Drop over the rack to mount'}
        </div>
        <p className="mt-1 text-[9.5px] text-muted">
          Esc cancel · Shift exact slot
        </p>
      </div>
    </motion.div>
  );
}
