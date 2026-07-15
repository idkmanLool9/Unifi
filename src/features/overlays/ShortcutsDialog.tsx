import { Dialog } from '@/components/ui/Dialog';
import { Kbd } from '@/components/ui/Kbd';
import { useOverlayStore } from '@/stores/overlayStore';

interface ShortcutRow {
  label: string;
  keys: string[];
}

const GROUPS: ReadonlyArray<{ title: string; rows: ShortcutRow[] }> = [
  {
    title: 'Tools',
    rows: [
      { label: 'Select', keys: ['V'] },
      { label: 'Pan', keys: ['H'] },
      { label: 'Orbit', keys: ['O'] },
    ],
  },
  {
    title: 'View',
    rows: [
      { label: 'Toggle floor grid', keys: ['G'] },
      { label: 'Toggle library panel', keys: ['['] },
      { label: 'Toggle inspector panel', keys: [']'] },
    ],
  },
  {
    title: 'Camera',
    rows: [
      { label: 'Fit view / frame selection', keys: ['F'] },
      { label: 'Fit to rack', keys: ['Double click'] },
    ],
  },
  {
    title: 'General',
    rows: [
      { label: 'Command palette', keys: ['⌘', 'K'] },
      { label: 'Settings', keys: ['⌘', ','] },
      { label: 'Keyboard shortcuts', keys: ['?'] },
      { label: 'Remove selected device', keys: ['Del'] },
      { label: 'Dismiss / deselect', keys: ['Esc'] },
    ],
  },
];

export function ShortcutsDialog() {
  const open = useOverlayStore((s) => s.shortcutsOpen);
  const setOpen = useOverlayStore((s) => s.setShortcutsOpen);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard Shortcuts"
      width={560}
    >
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="pb-2 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
              {group.title}
            </p>
            <div className="space-y-1.5">
              {group.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-secondary">{row.label}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-edge px-5 py-3 text-[11px] text-muted">
        Shortcuts are ignored while typing in a text field.
      </p>
    </Dialog>
  );
}
