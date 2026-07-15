import { AnimatePresence, motion } from 'framer-motion';
import { LibraryPanel } from '@/features/library/LibraryPanel';
import { useUIStore } from '@/stores/uiStore';

const SIDEBAR_WIDTH = 300;

/** Collapsible shell for the device library panel. */
export function LeftSidebar() {
  const open = useUIStore((s) => s.sidebarOpen);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden border-r border-edge bg-surface"
          aria-label="Device library"
        >
          <div className="h-full" style={{ width: SIDEBAR_WIDTH }}>
            <LibraryPanel />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
