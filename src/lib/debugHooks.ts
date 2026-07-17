import { useCableStore } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
import { allDevices, getDevice } from '@/features/devices/deviceRegistry';
import { allPhysicalPorts } from '@/features/cables/anchors';
import { focusCable, focusPort } from '@/features/viewport/focusActions';

/**
 * Opt-in automation hooks: with `rfdebug` in the query string the core
 * stores become reachable from the console/E2E harnesses. Nothing is
 * exposed in normal sessions.
 */
export function installDebugHooks(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.search.includes('rfdebug')) return;
  (window as unknown as Record<string, unknown>).__rackforge = {
    rackStore: useRackStore,
    deviceInstancesStore: useDeviceInstancesStore,
    cableStore: useCableStore,
    selectionStore: useSelectionStore,
    uiStore: useUIStore,
    getDevice,
    allDevices,
    allPhysicalPorts,
    focusCable,
    focusPort,
  };
}
