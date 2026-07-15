import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        className={cn(
          'h-8 w-full rounded-lg border border-edge bg-surface-raised pr-3 pl-8',
          'text-xs text-primary placeholder:text-muted',
          'transition-colors focus:border-accent focus:outline-none',
        )}
        {...props}
      />
    </div>
  );
}
