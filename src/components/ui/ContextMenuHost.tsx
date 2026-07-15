import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Kbd } from './Kbd';
import { useMenuStore, type MenuEntry, type MenuItem } from '@/stores/menuStore';
import { cn } from '@/lib/utils';

const MENU_WIDTH = 224;
const ITEM_HEIGHT = 28;
const PADDING = 6;

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry;
}

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        onClose();
        item.action?.();
      }}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-colors duration-75',
        'disabled:pointer-events-none disabled:opacity-40',
        item.danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-primary hover:bg-surface-hover',
      )}
    >
      {Icon && (
        <Icon
          className={cn('size-3.5 shrink-0', !item.danger && 'text-secondary')}
          strokeWidth={1.75}
        />
      )}
      <span className="flex-1 truncate text-xs">{item.label}</span>
      {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
    </button>
  );
}

/** Renders the singleton right-click menu at the cursor, edge-clamped. */
export function ContextMenuHost() {
  const menu = useMenuStore((s) => s.menu);
  const closeMenu = useMenuStore((s) => s.closeMenu);

  useEffect(() => {
    if (!menu) return;
    const close = () => closeMenu();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [menu, closeMenu]);

  const position = useMemo(() => {
    if (!menu) return { x: 0, y: 0 };
    const height =
      menu.entries.reduce(
        (h, e) => h + (isSeparator(e) ? 9 : ITEM_HEIGHT),
        0,
      ) +
      PADDING * 2;
    return {
      x: Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8),
    };
  }, [menu]);

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.1, ease: [0.32, 0.72, 0, 1] }}
          style={{ left: position.x, top: position.y, width: MENU_WIDTH }}
          className="fixed z-50 origin-top-left rounded-xl border border-edge bg-surface-raised p-1.5 shadow-overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.entries.map((entry, i) =>
            isSeparator(entry) ? (
              <div key={`sep-${i}`} className="mx-1 my-1 h-px bg-edge" />
            ) : (
              <MenuRow key={entry.id} item={entry} onClose={closeMenu} />
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
