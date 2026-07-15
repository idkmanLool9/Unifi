import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
}

/** Compact segmented control with a sliding active thumb. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg border border-edge bg-background/40 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-6 rounded-[6px] text-[11px] font-medium transition-colors duration-100',
              active
                ? 'text-primary'
                : 'text-muted hover:text-secondary',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                className="absolute inset-0 rounded-[6px] bg-surface-raised shadow-xs ring-1 ring-edge"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
