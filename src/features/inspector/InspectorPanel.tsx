import { AnimatePresence, motion } from 'framer-motion';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { useUIStore } from '@/stores/uiStore';
import { useRackStore } from '@/stores/rackStore';
import { SceneInfoSection } from './sections/SceneInfoSection';
import { CameraSection } from './sections/CameraSection';
import { ViewSection } from './sections/ViewSection';
import { LightingSection } from './sections/LightingSection';
import { QuickActionsSection } from './sections/QuickActionsSection';
import { ActivitySection } from './sections/ActivitySection';
import { RackSection } from './rack/RackSection';
import { DimensionsSection } from './rack/DimensionsSection';
import { RackUnitsSection } from './rack/RackUnitsSection';
import { AppearanceSection } from './rack/AppearanceSection';
import { VisibilitySection } from './rack/VisibilitySection';
import { MetadataSection } from './rack/MetadataSection';

const INSPECTOR_WIDTH = 288;
const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Right-hand inspector. With nothing selected it presents scene, camera,
 * view and lighting controls; selecting the rack swaps in the rack
 * inspector with a subtle crossfade.
 */
export function InspectorPanel() {
  const open = useUIStore((s) => s.inspectorOpen);
  const rack = useRackStore((s) => s.rack);
  const selected = useRackStore(
    (s) => s.rack !== null && s.selectedId === s.rack.id,
  );

  const showRack = selected && rack !== null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: INSPECTOR_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="shrink-0 overflow-hidden border-l border-edge bg-surface"
          aria-label="Inspector"
        >
          <div
            className="flex h-full flex-col"
            style={{ width: INSPECTOR_WIDTH }}
          >
            <PanelHeader title="Inspector">
              <span
                className={
                  showRack
                    ? 'rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent'
                    : 'rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-medium text-muted'
                }
              >
                {showRack ? `${rack.units}U Rack` : 'No selection'}
              </span>
            </PanelHeader>
            <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                {showRack ? (
                  <motion.div
                    key="rack"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15, ease: EASE }}
                  >
                    <RackSection rack={rack} />
                    <DimensionsSection rack={rack} />
                    <RackUnitsSection rack={rack} />
                    <AppearanceSection rack={rack} />
                    <VisibilitySection rack={rack} />
                    <MetadataSection rack={rack} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="scene"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15, ease: EASE }}
                  >
                    <SceneInfoSection />
                    <CameraSection />
                    <ViewSection />
                    <LightingSection />
                    <QuickActionsSection />
                    <ActivitySection />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
