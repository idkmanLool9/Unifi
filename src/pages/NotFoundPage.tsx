import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-edge bg-surface">
        <Compass className="size-6 text-muted" strokeWidth={1.5} />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-semibold">Page not found</p>
        <p className="text-xs text-secondary">
          The page you're looking for doesn't exist.
        </p>
      </div>
      <Link
        to="/"
        className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        Back to editor
      </Link>
    </div>
  );
}
