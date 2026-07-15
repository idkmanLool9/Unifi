import { motion } from 'framer-motion';
import {
  ChevronDown,
  Download,
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
import { LogoMark } from '@/components/ui/LogoMark';
import { Tooltip } from '@/components/ui/Tooltip';
import { useUIStore } from '@/stores/uiStore';
import { useRackStore } from '@/stores/rackStore';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
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

const THEME_META: Record<ThemePreference, { icon: LucideIcon; label: string }> =
  {
    light: { icon: Sun, label: 'Theme: Light' },
    dark: { icon: Moon, label: 'Theme: Dark' },
    system: { icon: Monitor, label: 'Theme: System' },
  };

function Divider() {
  return <div className="mx-1.5 h-4 w-px bg-edge-strong/60" />;
}

/** Segmented tool switcher with a sliding active pill. */
function ToolGroup() {
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);

  return (
    <div className="flex items-center gap-0.5 rounded-[10px] border border-edge bg-background/40 p-[3px] shadow-xs">
      {TOOLS.map(({ id, icon: Icon, label, shortcut }) => {
        const active = activeTool === id;
        return (
          <Tooltip key={id} label={label} shortcut={shortcut}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => setActiveTool(id)}
              className={cn(
                'relative flex size-7 items-center justify-center rounded-[7px]',
                'transition-colors duration-100',
                active
                  ? 'text-on-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-primary',
              )}
            >
              {active && (
                <motion.span
                  layoutId="active-tool-pill"
                  transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                  className="absolute inset-0 rounded-[7px] bg-accent shadow-xs"
                />
              )}
              <Icon className="relative size-4" strokeWidth={2} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function TopToolbar() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleInspector = useUIStore((s) => s.toggleInspector);

  const { icon: ThemeIcon, label: themeLabel } = THEME_META[theme];
  const documentName = useRackStore((s) => s.rack?.name ?? 'Untitled Project');

  return (
    <header className="relative z-20 flex h-[52px] shrink-0 items-center justify-between border-b border-edge bg-linear-to-b from-surface-raised/50 to-surface px-2.5">
      {/* Left: panel toggle + brand + document */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Tooltip label="Toggle library" shortcut="[">
          <IconButton
            label="Toggle library panel"
            active={false}
            onClick={toggleSidebar}
            className={cn(!sidebarOpen && 'text-muted')}
          >
            <PanelLeft className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Divider />
        <div className="flex items-center gap-2 pr-1 pl-0.5">
          <LogoMark />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            {APP_NAME}
          </span>
        </div>
        <Divider />
        <button
          type="button"
          className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-hover"
        >
          <span className="truncate text-xs font-medium text-secondary transition-colors group-hover:text-primary">
            {documentName}
          </span>
          <span className="size-1 shrink-0 rounded-full bg-warning/80" title="Unsaved changes" />
          <ChevronDown className="size-3 shrink-0 text-muted" strokeWidth={2} />
        </button>
      </div>

      {/* Center: tool group */}
      <ToolGroup />

      {/* Right: history + export + theme + inspector toggle */}
      <div className="flex flex-1 items-center justify-end gap-1">
        <Tooltip label="Undo" shortcut="⌘Z">
          <IconButton label="Undo" disabled>
            <Undo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⇧⌘Z">
          <IconButton label="Redo" disabled>
            <Redo2 className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Divider />
        <Tooltip label={themeLabel}>
          <IconButton
            label={themeLabel}
            onClick={() => setTheme(THEME_CYCLE[theme])}
          >
            <ThemeIcon className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Toggle inspector" shortcut="]">
          <IconButton
            label="Toggle inspector panel"
            onClick={toggleInspector}
            className={cn(!inspectorOpen && 'text-muted')}
          >
            <PanelRight className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Divider />
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          className="ml-0.5 flex h-7 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover"
        >
          <Download className="size-3.5" strokeWidth={2} />
          Export
        </motion.button>
      </div>
    </header>
  );
}
