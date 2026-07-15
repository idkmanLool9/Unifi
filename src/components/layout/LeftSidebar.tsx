import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  Cable,
  HardDrive,
  Network,
  Server,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUIStore } from '@/stores/uiStore';
import type { LibraryCategory } from '@/types';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  racks: Archive,
  servers: Server,
  networking: Network,
  storage: HardDrive,
  power: Zap,
  accessories: Cable,
};

const CATEGORIES: readonly LibraryCategory[] = [
  { id: 'racks', label: 'Racks', count: 0 },
  { id: 'servers', label: 'Servers', count: 0 },
  { id: 'networking', label: 'Networking', count: 0 },
  { id: 'storage', label: 'Storage', count: 0 },
  { id: 'power', label: 'Power', count: 0 },
  { id: 'accessories', label: 'Accessories', count: 0 },
];

function CategoryRow({ category }: { category: LibraryCategory }) {
  const Icon = CATEGORY_ICONS[category.id] ?? Archive;
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
    >
      <Icon
        className="size-4 text-muted transition-colors group-hover:text-secondary"
        strokeWidth={1.75}
      />
      <span className="flex-1 text-[13px] font-medium text-primary">
        {category.label}
      </span>
      <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-medium text-muted tabular-nums">
        {category.count}
      </span>
    </button>
  );
}

export function LeftSidebar() {
  const open = useUIStore((s) => s.sidebarOpen);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 264, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden border-r border-edge bg-surface"
          aria-label="Device library"
        >
          <div className="flex h-full w-[264px] flex-col">
            <PanelHeader title="Library" />
            <div className="p-3">
              <SearchInput placeholder="Search devices…" />
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
              {CATEGORIES.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </nav>
            <div className="border-t border-edge px-4 py-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Drag devices from the library into the rack to build your
                layout.
              </p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
