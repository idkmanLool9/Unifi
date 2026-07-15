import { AnimatePresence, motion } from 'framer-motion';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { useUIStore } from '@/stores/uiStore';
import { SceneInfoSection } from './sections/SceneInfoSection';
import { CameraSection } from './sections/CameraSection';
import { ViewSection } from './sections/ViewSection';
import { LightingSection } from './sections/LightingSection';
import { QuickActionsSection } from './sections/QuickActionsSection';
import { ActivitySection } from './sections/ActivitySection';

const INSPECTOR_WIDTH = 288;

/**
 * Right-hand inspector. With nothing selected it presents scene, camera,
 * view and lighting controls — so the panel is useful from the first
 * launch, in the manner of Fusion or UniFi Design Center.
 */
export function InspectorPanel() {
  const open = useUIStore((s) => s.inspectorOpen);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: INSPECTOR_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden border-l border-edge bg-surface"
          aria-label="Inspector"
        >
          <div
            className="flex h-full flex-col"
            style={{ width: INSPECTOR_WIDTH }}
          >
            <PanelHeader title="Inspector">
              <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-medium text-muted">
                No selection
              </span>
            </PanelHeader>
            <div className="flex-1 overflow-y-auto">
              <SceneInfoSection />
              <CameraSection />
              <ViewSection />
              <LightingSection />
              <QuickActionsSection />
              <ActivitySection />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
