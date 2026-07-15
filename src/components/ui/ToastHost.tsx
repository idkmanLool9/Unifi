import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const VARIANT_META: Record<ToastVariant, { icon: LucideIcon; tone: string }> = {
  success: { icon: CheckCircle2, tone: 'text-success' },
  info: { icon: Info, tone: 'text-accent' },
  warning: { icon: AlertTriangle, tone: 'text-warning' },
  error: { icon: XCircle, tone: 'text-danger' },
};

/** Bottom-right toast stack. Minimal, quiet, auto-dismissing. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-10 z-50 flex w-[320px] flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, tone } = VARIANT_META[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-edge bg-surface-raised p-3 shadow-overlay"
              role="status"
            >
              <Icon className={cn('mt-px size-4 shrink-0', tone)} strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug font-medium text-primary">
                  {t.title}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-[11px] leading-snug text-secondary">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-primary"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
