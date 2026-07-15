import {
  Hand,
  Monitor,
  Moon,
  MousePointer2,
  Orbit,
  PanelLeft,
  PanelRight,
  Redo2,
  Sun,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { useUIStore } from '@/stores/uiStore';
import { APP_NAME } from '@/lib/constants';
import type { EditorTool, ThemePreference } from '@/types';

const TOOLS: ReadonlyArray<{
  id: EditorTool;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}> = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'H' },
  { id: 'orbit', icon: Orbit, label: 'Orbit', shortcut: 'O' },
];

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_ICON: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function Divider() {
  return <div className="mx-1 h-5 w-px bg-edge" />;
}

export function TopToolbar() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleInspector = useUIStore((s) => s.toggleInspector);

  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-edge bg-surface px-2">
      {/* Left: panel toggle + brand + document */}
      <div className="flex min-w-0 items-center gap-1">
        <IconButton label="Toggle library panel" onClick={toggleSidebar}>
          <PanelLeft className="size-4" />
        </IconButton>
        <Divider />
        <div className="flex items-center gap-2 px-1">
          <img src="/favicon.svg" alt="" className="size-5 rounded-md" />
          <span className="text-sm font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </div>
        <Divider />
        <span className="truncate px-1 text-xs text-secondary">
          Untitled Rack
        </span>
      </div>

      {/* Center: tool group */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-edge bg-surface-raised p-0.5">
        {TOOLS.map(({ id, icon: Icon, label, shortcut }) => (
          <IconButton
            key={id}
            label={`${label} (${shortcut})`}
            active={activeTool === id}
            onClick={() => setActiveTool(id)}
          >
            <Icon className="size-4" />
          </IconButton>
        ))}
        <div className="hidden items-center gap-1 pr-2 pl-1.5 md:flex">
          <Kbd>{TOOLS.find((t) => t.id === activeTool)?.shortcut}</Kbd>
        </div>
      </div>

      {/* Right: history + theme + inspector toggle */}
      <div className="flex items-center gap-1">
        <IconButton label="Undo" disabled>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Redo" disabled>
          <Redo2 className="size-4" />
        </IconButton>
        <Divider />
        <IconButton
          label={`Theme: ${theme}`}
          onClick={() => setTheme(THEME_CYCLE[theme])}
        >
          <ThemeIcon className="size-4" />
        </IconButton>
        <IconButton label="Toggle inspector panel" onClick={toggleInspector}>
          <PanelRight className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}
