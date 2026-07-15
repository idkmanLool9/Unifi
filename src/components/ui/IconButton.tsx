import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface IconButtonProps extends HTMLMotionProps<'button'> {
  /** Accessible name (pair with <Tooltip> for the visual affordance). */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active = false, size = 'md', className, ...props }, ref) => (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.1 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-100',
        'text-secondary hover:bg-surface-hover hover:text-primary',
        'disabled:pointer-events-none disabled:opacity-35',
        size === 'sm' ? 'size-7' : 'size-8',
        active &&
          'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
