import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  action?: () => void;
}

export type MenuEntry = MenuItem | { separator: true };

interface OpenMenu {
  x: number;
  y: number;
  entries: MenuEntry[];
}

interface MenuState {
  menu: OpenMenu | null;
  openMenu: (x: number, y: number, entries: MenuEntry[]) => void;
  closeMenu: () => void;
}

/** Singleton context-menu state, rendered by ContextMenuHost. */
export const useMenuStore = create<MenuState>()((set) => ({
  menu: null,
  openMenu: (x, y, entries) => set({ menu: { x, y, entries } }),
  closeMenu: () => set({ menu: null }),
}));
