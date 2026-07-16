import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { useUIStore, INSPECTOR_WIDTH } from '@/stores/uiStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { getDevice, useRegistryStore } from '@/features/devices/deviceRegistry';
import { DeviceInspector } from './device/DeviceInspector';
import { SceneInfoSection } from './sections/SceneInfoSection';
import { CameraSection } from './sections/CameraSection';
import { ViewSection } from './sections/ViewSection';
import { LightingSection } from './sections/LightingSection';
import { QuickActionsSection } from './sections/QuickActionsSection';
import { ActivitySection } from './sections/ActivitySection';
import { RackSection } from './rack/RackSection';
import { DimensionsSection } from './rack/DimensionsSection';
import { RailsSection } from './rack/RailsSection';
import { RackUnitsSection } from './rack/RackUnitsSection';
import { AppearanceSection } from './rack/AppearanceSection';
import { VisibilitySection } from './rack/VisibilitySection';
import { MetadataSection } from './rack/MetadataSection';

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Right-hand inspector. With nothing selected it presents scene, camera,
 * view and lighting controls; selecting the rack swaps in the rack
 * inspector with a subtle crossfade.
 */
export function InspectorPanel() {
  const open = useUIStore((s) => s.inspectorOpen);
  const width = useUIStore((s) => s.inspectorWidth);
  const setWidth = useUIStore((s) => s.setInspectorWidth);
  const [resizing, setResizing] = useState(false);
  const rack = useRackStore((s) => s.rack);
  const selection = useSelectionStore((s) => s.selection);
  const instances = useDeviceInstancesStore((s) => s.instances);
  useRegistryStore((s) => s.version);

  const showRack = selection?.kind === 'rack' && rack !== null;
  const selectedInstance =
    selection?.kind === 'device'
      ? instances.find((i) => i.id === selection.instanceId)
      : undefined;
  const selectedDefinition = selectedInstance
    ? getDevice(selectedInstance.definitionId)
    : undefined;
  const showDevice =
    selectedInstance !== undefined && selectedDefinition !== undefined;

  const headerChip = showDevice
    ? selectedDefinition.productName
    : showRack
      ? `${rack.units}U Rack`
      : 'No selection';
  const contentKey = showDevice
    ? `device-${selectedInstance.id}`
    : showRack
      ? 'rack'
      : 'scene';

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={
            resizing ? { duration: 0 } : { duration: 0.18, ease: EASE }
          }
          className="relative shrink-0 border-l border-edge bg-surface"
          aria-label="Inspector"
        >
          <ResizeHandle
            edge="left"
            label="Resize inspector panel"
            value={width}
            min={INSPECTOR_WIDTH.min}
            max={INSPECTOR_WIDTH.max}
            defaultValue={INSPECTOR_WIDTH.default}
            onChange={setWidth}
            onResizeStart={() => setResizing(true)}
            onResizeEnd={() => setResizing(false)}
          />
          <div
            className="flex h-full flex-col overflow-hidden"
            style={{ width }}
          >
            <PanelHeader title="Inspector">
              <span
                className={
                  showRack || showDevice
                    ? 'max-w-[140px] truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent'
                    : 'rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-medium text-muted'
                }
              >
                {headerChip}
              </span>
            </PanelHeader>
            <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
              {/* Keyed remount with entrance-only animation (see M5 note) */}
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                {showDevice ? (
                  <DeviceInspector
                    instance={selectedInstance}
                    definition={selectedDefinition}
                  />
                ) : showRack ? (
                  <>
                    <RackSection rack={rack} />
                    <DimensionsSection rack={rack} />
                    <RailsSection rack={rack} />
                    <RackUnitsSection rack={rack} />
                    <AppearanceSection rack={rack} />
                    <VisibilitySection rack={rack} />
                    <MetadataSection rack={rack} />
                  </>
                ) : (
                  <>
                    <SceneInfoSection />
                    <CameraSection />
                    <ViewSection />
                    <LightingSection />
                    <QuickActionsSection />
                    <ActivitySection />
                  </>
                )}
              </motion.div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
