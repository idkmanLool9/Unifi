import type { ReactNode } from 'react';

/** Inline keyboard-shortcut hint, e.g. <Kbd>⌘K</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-edge bg-surface-raised px-1 font-sans text-[10px] font-semibold text-muted shadow-xs">
      {children}
    </kbd>
  );
}
