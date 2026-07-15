import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { cn } from '@/lib/utils';

interface ActivityItem {
  label: string;
  detail: string;
  accent?: boolean;
}

const ACTIVITY: readonly ActivityItem[] = [
  { label: 'Project created', detail: 'Just now', accent: true },
  { label: 'Viewport initialized', detail: 'Just now' },
  { label: 'Workspace restored', detail: 'On launch' },
];

export function ActivitySection() {
  return (
    <CollapsibleSection title="Recent Activity" defaultOpen={false}>
      <ol className="relative space-y-0">
        {ACTIVITY.map((item, i) => (
          <li key={item.label} className="relative flex gap-2.5 pb-3 last:pb-0">
            {/* Timeline rail */}
            {i < ACTIVITY.length - 1 && (
              <span
                aria-hidden
                className="absolute top-3.5 left-[3.5px] h-full w-px bg-edge"
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-surface',
                item.accent ? 'bg-accent' : 'bg-surface-active',
              )}
            />
            <div className="min-w-0">
              <p className="text-xs leading-snug font-medium text-primary">
                {item.label}
              </p>
              <p className="text-[11px] leading-snug text-muted">
                {item.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </CollapsibleSection>
  );
}
