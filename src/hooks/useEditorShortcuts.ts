import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useCableStore } from '@/stores/cableStore';
import { useCableToolStore } from '@/stores/cableToolStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMenuStore } from '@/stores/menuStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { requestRemoveDevice } from '@/features/devices/removeDeviceAction';
import { toast } from '@/stores/toastStore';
import type { EditorTool } from '@/types';

const TOOL_KEYS: Record<string, EditorTool> = {
  v: 'select',
  h: 'pan',
  o: 'orbit',
  c: 'cable',
};

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/**
 * Global editor shortcuts. Single keys drive tools and views (V/H/O, G,
 * F, [ ], ?, Escape); modifier chords drive app-level actions (⌘K
 * command palette, ⌘, settings). Ignored while typing in form fields;
 * single-key shortcuts pause while a modal overlay is open.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const overlays = useOverlayStore.getState();

      // Modifier chords work everywhere, including inside text fields.
      if (event.metaKey || event.ctrlKey) {
        if (key === 'k') {
          event.preventDefault();
          overlays.setCommandPaletteOpen(!overlays.commandPaletteOpen);
        } else if (key === ',') {
          event.preventDefault();
          overlays.setSettingsOpen(true);
        }
        return;
      }
      if (event.altKey) return;
      if (isEditableTarget(event.target)) return;
      // Modal overlays own the keyboard while open (they handle Escape).
      if (overlays.anyOpen()) return;

      const { setActiveTool, toggleSidebar, toggleInspector } =
        useUIStore.getState();

      if (key in TOOL_KEYS) {
        setActiveTool(TOOL_KEYS[key]);
      } else if (key === '[') {
        toggleSidebar();
      } else if (key === ']') {
        toggleInspector();
      } else if (key === 'g') {
        useViewSettingsStore.getState().toggleGrid();
      } else if (key === 'f') {
        useViewportStore.getState().dispatchCamera({ type: 'fit' });
      } else if (key === '?') {
        overlays.setShortcutsOpen(true);
      } else if (key === 'delete' || key === 'backspace') {
        const selection = useSelectionStore.getState().selection;
        if (selection?.kind === 'cable') {
          // Remove the selected cable.
          useCableStore.getState().removeCable(selection.cableId);
          useSelectionStore.getState().clear();
          toast({ variant: 'success', title: 'Cable removed' });
        } else if (selection?.kind === 'device') {
          // Remove the selected mounted device (confirming when cabled).
          requestRemoveDevice(selection.instanceId);
        }
      } else if (key === 'escape') {
        // Dismiss the topmost layer: pending cable, menu, device
        // preview, then selection.
        const menu = useMenuStore.getState();
        const library = useLibraryStore.getState();
        const cableTool = useCableToolStore.getState();
        if (cableTool.sourceEnd) {
          cableTool.reset();
        } else if (menu.menu) {
          menu.closeMenu();
        } else if (library.selectedDeviceId) {
          library.selectDevice(null);
        } else {
          useSelectionStore.getState().clear();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
