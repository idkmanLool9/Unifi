import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Panel width in pixels. */
  width?: number;
  children: ReactNode;
}

/**
 * Modal dialog: dimmed blurred backdrop, centered panel, Escape and
 * backdrop-click to dismiss. Escape is captured before it reaches global
 * editor shortcuts, so closing a dialog never also clears a selection.
 */
export function Dialog({
  open,
  onClose,
  title,
  width = 480,
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="relative flex max-h-[min(640px,calc(100vh-48px))] flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-overlay"
            style={{ width, maxWidth: 'calc(100vw - 48px)' }}
          >
            {title && (
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-edge pr-2.5 pl-5">
                <h2 className="text-[13px] font-semibold tracking-tight">
                  {title}
                </h2>
                <IconButton label="Close" size="sm" onClick={onClose}>
                  <X className="size-3.5" strokeWidth={2} />
                </IconButton>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
