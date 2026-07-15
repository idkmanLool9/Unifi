import { useSyncExternalStore } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { ResolvedTheme } from '@/types';

const media =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function subscribe(onChange: () => void): () => void {
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

function getSystemTheme(): ResolvedTheme {
  return media?.matches ? 'dark' : 'light';
}

/** The theme actually in effect, with `system` resolved live. */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useUIStore((s) => s.theme);
  const system = useSyncExternalStore(
    subscribe,
    getSystemTheme,
    (): ResolvedTheme => 'dark',
  );
  return preference === 'system' ? system : preference;
}
