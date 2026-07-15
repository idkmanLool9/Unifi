import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Compact iOS-style toggle switch. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-accent' : 'bg-surface-active',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <motion.span
        aria-hidden
        animate={{ x: checked ? 13 : 2 }}
        transition={{ type: 'spring', stiffness: 700, damping: 40 }}
        className="absolute top-[2px] left-0 block size-[14px] rounded-full bg-white shadow-xs"
      />
    </button>
  );
}
