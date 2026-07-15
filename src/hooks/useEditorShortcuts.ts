import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
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
 * Global editor shortcuts: V/H/O switch tools, [ toggles the library,
 * ] toggles the inspector. Ignored while typing in form fields.
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
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
