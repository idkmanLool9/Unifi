import type { ReactNode } from 'react';

/** Compact label/value row used across inspector sections. */
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-6 items-center justify-between gap-3">
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-[11px] font-medium text-primary tabular-nums">
        {children}
      </span>
    </div>
  );
}
