import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        type="search"
        className={cn(
          'h-8 w-full rounded-lg border border-edge bg-surface-raised pr-3 pl-8',
          'text-xs text-primary placeholder:text-muted shadow-xs',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'hover:border-edge-strong',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft',
        )}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
