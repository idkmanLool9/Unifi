import type { ReactNode } from 'react';

/** Inline keyboard-shortcut hint, e.g. <Kbd>V</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-edge bg-surface-raised px-1 font-sans text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}
