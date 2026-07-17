import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Cable,
  ChevronDown,
  Command,
  Copy,
  Download,
  FolderOpen,
  Hand,
  LibraryBig,
  Monitor,
  Moon,
  MousePointer2,
  Orbit,
  PanelLeft,
  PanelRight,
  PencilLine,
  Redo2,
  Settings,
  Sun,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { LogoMark } from '@/components/ui/LogoMark';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  exportProject,
  requestProjectImport,
} from '@/features/project/projectActions';
import { useMenuStore } from '@/stores/menuStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
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
  { id: 'cable', icon: Cable, label: 'Cable Tool', shortcut: 'C' },
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
  const navigate = useNavigate();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleInspector = useUIStore((s) => s.toggleInspector);

  const { icon: ThemeIcon, label: themeLabel } = THEME_META[theme];
  const documentName = useRackStore((s) => s.rack?.name ?? 'Untitled Project');
  const openMenu = useMenuStore((s) => s.openMenu);
  const setCommandPaletteOpen = useOverlayStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useOverlayStore((s) => s.setSettingsOpen);
  const setConfirmDeleteRackOpen = useOverlayStore(
    (s) => s.setConfirmDeleteRackOpen,
  );

  const openProjectMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hasRack = useRackStore.getState().rack !== null;
    openMenu(rect.left, rect.bottom + 6, [
      {
        id: 'rename',
        label: 'Rename rack',
        icon: PencilLine,
        disabled: !hasRack,
        action: () => {
          if (useRackStore.getState().rack) {
            useSelectionStore.getState().selectRack();
          }
          if (!useUIStore.getState().inspectorOpen)
            useUIStore.getState().toggleInspector();
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicate rack',
        icon: Copy,
        disabled: true,
      },
      { separator: true },
      {
        id: 'open',
        label: 'Open project…',
        icon: FolderOpen,
        action: () => requestProjectImport(),
      },
      {
        id: 'export',
        label: 'Export project…',
        icon: Download,
        action: () => void exportProject(),
      },
      { separator: true },
      {
        id: 'delete',
        label: 'Delete rack…',
        icon: Trash2,
        danger: true,
        disabled: !hasRack,
        action: () => setConfirmDeleteRackOpen(true),
      },
    ]);
  };

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
          aria-haspopup="menu"
          onClick={openProjectMenu}
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
        <Tooltip label="Device Library">
          <IconButton
            label="Open the Device Library"
            onClick={() => void navigate('/library')}
          >
            <LibraryBig className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Command palette" shortcut="⌘K">
          <IconButton
            label="Command palette"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip label={themeLabel}>
          <IconButton
            label={themeLabel}
            onClick={() => setTheme(THEME_CYCLE[theme])}
          >
            <ThemeIcon className="size-4" strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Settings" shortcut="⌘,">
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" strokeWidth={1.75} />
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
        <Tooltip label="Save the whole project as one file">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => void exportProject()}
            className="ml-0.5 flex h-7 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover"
          >
            <Download className="size-3.5" strokeWidth={2} />
            Export
          </motion.button>
        </Tooltip>
      </div>
    </header>
  );
}
