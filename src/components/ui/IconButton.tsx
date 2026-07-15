import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also used as the tooltip. */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active = false, size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-100',
        'text-secondary hover:bg-surface-hover hover:text-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'size-7' : 'size-8',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
