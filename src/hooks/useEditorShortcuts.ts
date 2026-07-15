import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useRackStore } from '@/stores/rackStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import type { EditorTool } from '@/types';

const TOOL_KEYS: Record<string, EditorTool> = {
  v: 'select',
  h: 'pan',
  o: 'orbit',
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
 * Global editor shortcuts: V/H/O switch tools, [ and ] toggle the side
 * panels, G toggles the floor grid, F fits the view, Escape clears the
 * selection. Ignored while typing in form fields.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
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
      } else if (key === 'escape') {
        // Dismiss the topmost layer first: device preview, then selection.
        const library = useLibraryStore.getState();
        if (library.selectedDeviceId) {
          library.selectDevice(null);
        } else {
          useRackStore.getState().setSelected(null);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
