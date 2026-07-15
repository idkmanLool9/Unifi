import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  Cable,
  ChevronRight,
  HardDrive,
  Network,
  PackageOpen,
  Server,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { LibraryCategory } from '@/types';

const SIDEBAR_WIDTH = 268;

interface CategoryGroup {
  id: string;
  label: string;
  categories: ReadonlyArray<LibraryCategory & { icon: LucideIcon }>;
}

const GROUPS: readonly CategoryGroup[] = [
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    categories: [
      {
        id: 'racks',
        label: 'Racks',
        description: 'Frames & enclosures',
        count: 0,
        icon: Archive,
      },
      {
        id: 'servers',
        label: 'Servers',
        description: 'Compute hardware',
        count: 0,
        icon: Server,
      },
      {
        id: 'storage',
        label: 'Storage',
        description: 'Disk shelves & NAS',
        count: 0,
        icon: HardDrive,
      },
    ],
  },
  {
    id: 'connectivity',
    label: 'Connectivity & Power',
    categories: [
      {
        id: 'networking',
        label: 'Networking',
        description: 'Switches & routers',
        count: 0,
        icon: Network,
      },
      {
        id: 'power',
        label: 'Power',
        description: 'PDUs & UPS units',
        count: 0,
        icon: Zap,
      },
      {
        id: 'accessories',
        label: 'Accessories',
        description: 'Panels & cable trays',
        count: 0,
        icon: Cable,
      },
    ],
  },
];

function CategoryRow({
  category,
  expanded,
  onToggle,
}: {
  category: CategoryGroup['categories'][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = category.icon;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[10px] transition-colors',
        expanded && 'bg-surface-raised shadow-xs ring-1 ring-edge',
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left',
          'transition-colors duration-100',
          !expanded && 'hover:bg-surface-hover',
        )}
      >
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-100',
            expanded
              ? 'border-transparent bg-accent-soft text-accent'
              : 'border-edge bg-surface-raised text-muted group-hover:text-secondary',
          )}
        >
          <Icon className="size-[15px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight font-medium text-primary">
            {category.label}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted">
            {category.description}
          </span>
        </span>
        <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-semibold text-muted tabular-nums">
          {category.count}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="flex text-muted"
        >
          <ChevronRight className="size-3.5" strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-edge-strong px-3 py-4 text-center">
                <PackageOpen
                  className="size-4 text-muted"
                  strokeWidth={1.5}
                />
                <p className="text-[11px] leading-snug text-secondary">
                  No {category.label.toLowerCase()} yet
                </p>
                <p className="text-[10px] leading-snug text-muted">
                  The device library arrives in an upcoming release
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LeftSidebar() {
  const open = useUIStore((s) => s.sidebarOpen);
  const [expandedId, setExpandedId] = useState<string | null>('racks');

  const totalDevices = GROUPS.flatMap((g) => g.categories).reduce(
    (sum, c) => sum + c.count,
    0,
  );

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden border-r border-edge bg-surface"
          aria-label="Device library"
        >
          <div
            className="flex h-full flex-col"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <PanelHeader title="Library">
              <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-semibold text-muted tabular-nums">
                {totalDevices}
              </span>
            </PanelHeader>

            <div className="px-3 pt-3 pb-2">
              <SearchInput placeholder="Search devices…" />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-2.5 pt-1 pb-3">
              {GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.categories.map((category) => (
                      <CategoryRow
                        key={category.id}
                        category={category}
                        expanded={expandedId === category.id}
                        onToggle={() =>
                          setExpandedId(
                            expandedId === category.id ? null : category.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-edge px-4 py-2.5">
              <p className="text-[11px] text-muted">
                {GROUPS.flatMap((g) => g.categories).length} categories ·{' '}
                {totalDevices} devices
              </p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
