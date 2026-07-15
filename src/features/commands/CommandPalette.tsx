import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { COMMANDS, type Command } from './commands';
import { Kbd } from '@/components/ui/Kbd';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';

function matches(command: Command, query: string): boolean {
  const haystack =
    `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

/**
 * Raycast-style command palette (⌘K): search, arrow-key navigation, and
 * grouped commands. Actions run real store operations where they exist and
 * raise placeholder toasts where the feature is still on the roadmap.
 */
export function CommandPalette() {
  const open = useOverlayStore((s) => s.commandPaletteOpen);
  const setOpen = useOverlayStore((s) => s.setCommandPaletteOpen);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (query.trim() ? COMMANDS.filter((c) => matches(c, query)) : [...COMMANDS]),
    [query],
  );

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  // Keep the active row in view
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runCommand = (command: Command) => {
    if (command.disabled?.()) return;
    setOpen(false);
    command.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const command = results[activeIndex];
      if (command) runCommand(command);
    }
  };

  // Group in display order
  const grouped = useMemo(() => {
    const groups = new Map<string, { command: Command; index: number }[]>();
    results.forEach((command, index) => {
      const list = groups.get(command.group) ?? [];
      list.push({ command, index });
      groups.set(command.group, list);
    });
    return [...groups.entries()];
  }, [results]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -6 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="relative flex h-fit max-h-[420px] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-overlay"
            onKeyDown={onKeyDown}
          >
            <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-edge px-4">
              <Search className="size-4 shrink-0 text-muted" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search…"
                aria-label="Search commands"
                className="h-full flex-1 bg-transparent text-[13px] text-primary placeholder:text-muted focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-secondary">
                  No commands match “{query}”
                </p>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 pt-1.5 pb-1 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
                      {group}
                    </p>
                    {items.map(({ command, index }) => {
                      const Icon = command.icon;
                      const disabled = command.disabled?.() ?? false;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={command.id}
                          type="button"
                          data-active={active}
                          disabled={disabled}
                          onClick={() => runCommand(command)}
                          onPointerMove={() => setActiveIndex(index)}
                          className={cn(
                            'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors duration-75',
                            active && 'bg-surface-hover',
                            disabled && 'opacity-40',
                          )}
                        >
                          <Icon
                            className="size-4 shrink-0 text-secondary"
                            strokeWidth={1.75}
                          />
                          <span className="flex-1 truncate text-[12.5px] text-primary">
                            {command.label}
                          </span>
                          {command.shortcut && <Kbd>{command.shortcut}</Kbd>}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex h-8 shrink-0 items-center gap-3 border-t border-edge px-3.5 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <Kbd>↑↓</Kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> Run
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
