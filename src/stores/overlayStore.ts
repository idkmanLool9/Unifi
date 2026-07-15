import { create } from 'zustand';

interface OverlayState {
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  confirmDeleteRackOpen: boolean;

  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setConfirmDeleteRackOpen: (open: boolean) => void;

  /** True when any modal overlay is open (used to gate global shortcuts). */
  anyOpen: () => boolean;
}

/** Visibility of app-level overlays: command palette, dialogs. Transient. */
export const useOverlayStore = create<OverlayState>()((set, get) => ({
  commandPaletteOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  confirmDeleteRackOpen: false,

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setConfirmDeleteRackOpen: (confirmDeleteRackOpen) =>
    set({ confirmDeleteRackOpen }),

  anyOpen: () => {
    const s = get();
    return (
      s.commandPaletteOpen ||
      s.settingsOpen ||
      s.shortcutsOpen ||
      s.confirmDeleteRackOpen
    );
  },
}));
