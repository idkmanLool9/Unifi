import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  /** Optional keyboard shortcut rendered beside the label. */
  shortcut?: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}

const SHOW_DELAY_MS = 350;

/**
 * Lightweight hover tooltip in the Apple/Figma idiom: dark pill, small
 * type, appears after a short delay, never captures the pointer.
 */
export function Tooltip({
  label,
  shortcut,
  side = 'bottom',
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96, x: '-50%', y: side === 'bottom' ? -2 : 2 }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: '-50%', y: 0 }}
            transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'pointer-events-none absolute left-1/2 z-50 flex items-center gap-1.5',
              'rounded-md bg-tooltip px-2 py-1 whitespace-nowrap shadow-tooltip',
              'text-[11px] font-medium text-tooltip-text',
              side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            )}
          >
            {label}
            {shortcut && (
              <span className="rounded-sm bg-white/12 px-1 py-px text-[10px] font-semibold text-tooltip-text/70">
                {shortcut}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
