import type { ResolvedTheme } from '@/types';

/**
 * Colors used inside the WebGL scene, per theme. Three.js materials can't
 * read CSS variables, so these mirror the grid tokens in globals.css.
 */
export const VIEWPORT_THEME: Record<
  ResolvedTheme,
  { gridCell: string; gridSection: string }
> = {
  dark: { gridCell: '#2a2d33', gridSection: '#3d4149' },
  light: { gridCell: '#c3c9d2', gridSection: '#9fa7b3' },
};
