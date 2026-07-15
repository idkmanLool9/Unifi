import { cn } from '@/lib/utils';

/** RackForge brand mark: rack bars on an accent gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-[7px]',
        'bg-linear-to-b from-[#5b8df8] to-[#3a6fe8] shadow-xs',
        'size-[22px]',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
        <rect x="2.5" y="3" width="11" height="2.4" rx="1" fill="white" fillOpacity="0.95" />
        <rect x="2.5" y="6.8" width="11" height="2.4" rx="1" fill="white" fillOpacity="0.62" />
        <rect x="2.5" y="10.6" width="11" height="2.4" rx="1" fill="white" fillOpacity="0.34" />
      </svg>
    </span>
  );
}
