import { create } from 'zustand';
import type { ViewportStats } from '@/types';

interface ViewportState extends ViewportStats {
  setStats: (stats: ViewportStats) => void;
}

/**
 * Transient, non-persisted render statistics. Written by the viewport's
 * stats probe (throttled) and read by the status bar. Kept separate from
 * the UI store so high-frequency updates never touch persisted state.
 */
export const useViewportStore = create<ViewportState>()((set) => ({
  fps: 0,
  triangles: 0,
  drawCalls: 0,
  setStats: (stats) => set(stats),
}));
