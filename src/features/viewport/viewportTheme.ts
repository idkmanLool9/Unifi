import type { ResolvedTheme } from '@/types';

/**
 * Colors used inside the WebGL scene, per theme. Three.js materials can't
 * read CSS variables, so these mirror the grid tokens in globals.css.
 */
export const VIEWPORT_THEME: Record<
  ResolvedTheme,
  {
    gridCell: string;
    gridSection: string;
    /** Selection/highlight accent used by 3D helpers. */
    accent: string;
    /** Ink color for floor markers (FRONT label). */
    markerInk: string;
  }
> = {
  dark: {
    gridCell: '#2a2d33',
    gridSection: '#3d4149',
    accent: '#4c82f7',
    markerInk: 'rgba(255, 255, 255, 0.55)',
  },
  light: {
    gridCell: '#c3c9d2',
    gridSection: '#9fa7b3',
    accent: '#2f6bef',
    markerInk: 'rgba(25, 35, 55, 0.45)',
  },
};
