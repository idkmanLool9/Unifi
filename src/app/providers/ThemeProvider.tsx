import { useEffect, type ReactNode } from 'react';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Keeps the `data-theme` attribute on <html> in sync with the UI store. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const resolved = useResolvedTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return children;
}
