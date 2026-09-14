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
    <div className="flex min-h-7 items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-right text-xs font-medium text-primary tabular-nums">
        {children}
      </span>
    </div>
  );
}
