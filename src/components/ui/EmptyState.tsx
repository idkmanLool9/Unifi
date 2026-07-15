import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Centered placeholder for panels with no content yet. */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-edge bg-surface-raised">
        <Icon className="size-5 text-muted" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="text-xs leading-relaxed text-secondary">{description}</p>
      </div>
    </div>
  );
}
