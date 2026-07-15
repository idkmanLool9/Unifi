import { AnimatePresence, motion } from 'framer-motion';
import { SquareDashed } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { useUIStore } from '@/stores/uiStore';

export function InspectorPanel() {
  const open = useUIStore((s) => s.inspectorOpen);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 288, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden border-l border-edge bg-surface"
          aria-label="Inspector"
        >
          <div className="flex h-full w-72 flex-col">
            <PanelHeader title="Inspector" />
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={SquareDashed}
                title="No selection"
                description="Select an object in the viewport to inspect and edit its properties."
              />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
