import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Inspector-style collapsible section with an animated disclosure. */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-edge">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group flex h-9 w-full items-center gap-1.5 px-3 text-left transition-colors hover:bg-surface-hover"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="flex text-muted transition-colors group-hover:text-secondary"
        >
          <ChevronRight className="size-3.5" strokeWidth={2} />
        </motion.span>
        <span
          className={cn(
            'text-[11px] font-semibold tracking-wide',
            open ? 'text-primary' : 'text-secondary',
          )}
        >
          {title}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-0.5 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
