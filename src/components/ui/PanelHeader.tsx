import type { ReactNode } from 'react';

interface PanelHeaderProps {
  title: string;
  /** Optional actions rendered on the right edge of the header. */
  children?: ReactNode;
}

/** Shared header for side panels (library, inspector, …). */
export function PanelHeader({ title, children }: PanelHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-edge px-3">
      <h2 className="text-[11px] font-semibold tracking-widest text-secondary uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}
