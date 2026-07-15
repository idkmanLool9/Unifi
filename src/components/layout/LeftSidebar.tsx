import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LibraryPanel } from '@/features/library/LibraryPanel';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { useUIStore, SIDEBAR_WIDTH } from '@/stores/uiStore';

/** Collapsible, resizable shell for the device library panel. */
export function LeftSidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const width = useUIStore((s) => s.sidebarWidth);
  const setWidth = useUIStore((s) => s.setSidebarWidth);
  const [resizing, setResizing] = useState(false);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={
            resizing
              ? { duration: 0 }
              : { duration: 0.18, ease: [0.32, 0.72, 0, 1] }
          }
          className="relative shrink-0 border-r border-edge bg-surface"
          aria-label="Device library"
        >
          <div className="h-full overflow-hidden" style={{ width }}>
            <LibraryPanel />
          </div>
          <ResizeHandle
            edge="right"
            label="Resize library panel"
            value={width}
            min={SIDEBAR_WIDTH.min}
            max={SIDEBAR_WIDTH.max}
            defaultValue={SIDEBAR_WIDTH.default}
            onChange={setWidth}
            onResizeStart={() => setResizing(true)}
            onResizeEnd={() => setResizing(false)}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
