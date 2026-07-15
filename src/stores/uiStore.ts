import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EditorTool, ThemePreference } from '@/types';
import { UI_STORE_KEY } from '@/lib/constants';

export const SIDEBAR_WIDTH = { default: 300, min: 264, max: 420 } as const;
export const INSPECTOR_WIDTH = { default: 288, min: 264, max: 400 } as const;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

interface UIState {
  theme: ThemePreference;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  activeTool: EditorTool;

  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setActiveTool: (tool: EditorTool) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      inspectorOpen: true,
      sidebarWidth: SIDEBAR_WIDTH.default,
      inspectorWidth: INSPECTOR_WIDTH.default,
      activeTool: 'select',

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setSidebarWidth: (width) =>
        set({
          sidebarWidth: clamp(width, SIDEBAR_WIDTH.min, SIDEBAR_WIDTH.max),
        }),
      setInspectorWidth: (width) =>
        set({
          inspectorWidth: clamp(
            width,
            INSPECTOR_WIDTH.min,
            INSPECTOR_WIDTH.max,
          ),
        }),
      setActiveTool: (activeTool) => set({ activeTool }),
    }),
    { name: UI_STORE_KEY },
  ),
);
