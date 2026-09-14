import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  /** Optional trailing content in the header (badges, quick actions). */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * A self-contained inspector card. Sections read as discrete grouped cards
 * on the panel surface (iOS/UniFi-style) rather than flat hairline-divided
 * rows — the card carries its own inset margin, so any panel that stacks
 * these gets consistent rhythm for free.
 */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  aside,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mx-2.5 mt-2.5 overflow-hidden rounded-xl border border-edge bg-surface-raised shadow-xs">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="group flex h-9 flex-1 items-center gap-1.5 px-3 text-left transition-colors hover:bg-surface-hover"
        >
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex text-muted transition-colors group-hover:text-secondary"
          >
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </motion.span>
          <span
            className={cn(
              'text-[11.5px] font-semibold tracking-[-0.01em]',
              open ? 'text-primary' : 'text-secondary',
            )}
          >
            {title}
          </span>
        </button>
        {aside && <div className="flex items-center pr-2">{aside}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-edge px-3 pt-2.5 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
