import { useEffect } from 'react';
import { useAuthoringStore } from './authoringStore';

/** True when the event originates from a text-entry element. */
const isTyping = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
};

/**
 * Authoring-mode keyboard map: Q/W/E/R tools, ⌘D duplicate, Delete,
 * Escape deselect, F frame ports, ⌘S save. Registered only while the
 * authoring page is mounted.
 */
export function useAuthoringShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useAuthoringStore.getState();
      if (!store.deviceId) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (!isTyping(e)) store.duplicateSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        store.save();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (isTyping(e)) return;
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (isTyping(e)) return;
        e.preventDefault();
        store.redo();
        return;
      }
      if (isTyping(e)) return;

      switch (e.key.toLowerCase()) {
        case 'q':
          store.setTool('select');
          break;
        case 'w':
          store.setTool('move');
          break;
        case 'e':
          store.setTool('rotate');
          break;
        case 'r':
          store.setTool('scale');
          break;
        case 'f':
          store.dispatchCamera({
            type: store.selection.length > 0 ? 'frame-ports' : 'frame-device',
            face: 'front',
          });
          break;
        case 'delete':
        case 'backspace':
          store.deleteSelection();
          break;
        case 'escape':
          store.clearSelection();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
