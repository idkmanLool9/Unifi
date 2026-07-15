import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EditorTool, ThemePreference } from '@/types';
import { UI_STORE_KEY } from '@/lib/constants';

interface UIState {
  theme: ThemePreference;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  activeTool: EditorTool;

  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setActiveTool: (tool: EditorTool) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      inspectorOpen: true,
      activeTool: 'select',

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setActiveTool: (activeTool) => set({ activeTool }),
    }),
    { name: UI_STORE_KEY },
  ),
);
