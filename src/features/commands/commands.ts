import {
  Box,
  Cable,
  Camera,
  Download,
  Eye,
  FolderOpen,
  Grid3x3,
  Keyboard,
  LayoutPanelLeft,
  LayoutPanelTop,
  Magnet,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { faceDetail, frameSelection } from '@/features/viewport/focusActions';
import { useOverlayStore } from '@/stores/overlayStore';
import { useRackStore } from '@/stores/rackStore';
import { useUIStore } from '@/stores/uiStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { toast } from '@/stores/toastStore';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string;
  disabled?: () => boolean;
  run: () => void;
}

/** Focuses the library search field (opening the sidebar if needed). */
function focusLibrarySearch() {
  const ui = useUIStore.getState();
  if (!ui.sidebarOpen) ui.toggleSidebar();
  // Defer until the sidebar has mounted.
  setTimeout(() => {
    document
      .getElementById('library-search')
      ?.focus({ preventScroll: false });
  }, 60);
}

export const COMMANDS: readonly Command[] = [
  // Project
  {
    id: 'project.open',
    label: 'Open Project…',
    group: 'Project',
    icon: FolderOpen,
    keywords: 'load file browse',
    run: () =>
      toast({
        variant: 'info',
        title: 'Project browser coming soon',
        description: 'Cloud projects arrive with the Supabase milestone.',
      }),
  },
  {
    id: 'project.save',
    label: 'Save Project',
    group: 'Project',
    icon: Save,
    shortcut: '⌘S',
    run: () =>
      toast({
        variant: 'success',
        title: 'Project saved',
        description: 'Your workspace is stored locally.',
      }),
  },
  {
    id: 'project.export',
    label: 'Export…',
    group: 'Project',
    icon: Download,
    keywords: 'pdf report render',
    run: () =>
      toast({
        variant: 'info',
        title: 'Export coming soon',
        description: 'PDF and image export ship with the reporting milestone.',
      }),
  },
  {
    id: 'project.delete-rack',
    label: 'Delete Rack…',
    group: 'Project',
    icon: Trash2,
    keywords: 'remove clear',
    disabled: () => useRackStore.getState().rack === null,
    run: () => useOverlayStore.getState().setConfirmDeleteRackOpen(true),
  },

  // Cables
  {
    id: 'cables.connections',
    label: 'Connection List',
    group: 'Cables',
    icon: Cable,
    keywords: 'cables ports links wiring',
    run: () => useOverlayStore.getState().setConnectionsOpen(true),
  },
  {
    id: 'cables.tool',
    label: 'Cable Tool',
    group: 'Cables',
    icon: Cable,
    shortcut: 'C',
    keywords: 'connect wire patch',
    run: () => useUIStore.getState().setActiveTool('cable'),
  },

  // Camera
  {
    id: 'camera.frame-selection',
    label: 'Frame Selection',
    group: 'Camera',
    icon: Box,
    shortcut: 'F',
    keywords: 'focus zoom selected device port cable',
    run: () => frameSelection(),
  },
  {
    id: 'camera.close-up',
    label: 'Close-Up on Selection',
    group: 'Camera',
    icon: Search,
    keywords: 'zoom detail inspect macro',
    run: () => frameSelection(true),
  },
  {
    id: 'camera.front-detail',
    label: 'Front Detail View',
    group: 'Camera',
    icon: Square,
    keywords: 'faceplate ports rails close',
    run: () => faceDetail('front'),
  },
  {
    id: 'camera.rear-detail',
    label: 'Rear Detail View',
    group: 'Camera',
    icon: Square,
    keywords: 'back power psu close',
    run: () => faceDetail('rear'),
  },
  {
    id: 'camera.fit',
    label: 'Frame Rack',
    group: 'Camera',
    icon: Box,
    keywords: 'fit frame whole zoom out',
    run: () => useViewportStore.getState().dispatchCamera({ type: 'fit' }),
  },
  {
    id: 'camera.reset',
    label: 'Reset Camera',
    group: 'Camera',
    icon: RotateCcw,
    run: () => useViewportStore.getState().dispatchCamera({ type: 'reset' }),
  },
  {
    id: 'camera.top',
    label: 'Top View',
    group: 'Camera',
    icon: Square,
    keywords: 'plan overhead',
    run: () =>
      useViewportStore
        .getState()
        .dispatchCamera({ type: 'preset', view: 'top' }),
  },

  // View
  {
    id: 'view.grid',
    label: 'Toggle Floor Grid',
    group: 'View',
    icon: Grid3x3,
    shortcut: 'G',
    run: () => useViewSettingsStore.getState().toggleGrid(),
  },
  {
    id: 'view.snap',
    label: 'Toggle Snapping',
    group: 'View',
    icon: Magnet,
    run: () => useViewSettingsStore.getState().toggleSnap(),
  },
  {
    id: 'view.ao',
    label: 'Toggle Ambient Occlusion',
    group: 'View',
    icon: Eye,
    keywords: 'render quality ssao',
    run: () => useViewSettingsStore.getState().toggleAO(),
  },

  // Panels
  {
    id: 'panels.library',
    label: 'Toggle Library Panel',
    group: 'Panels',
    icon: LayoutPanelLeft,
    shortcut: '[',
    run: () => useUIStore.getState().toggleSidebar(),
  },
  {
    id: 'panels.inspector',
    label: 'Toggle Inspector Panel',
    group: 'Panels',
    icon: LayoutPanelTop,
    shortcut: ']',
    run: () => useUIStore.getState().toggleInspector(),
  },
  {
    id: 'panels.search',
    label: 'Search Devices',
    group: 'Panels',
    icon: Search,
    keywords: 'find device library focus',
    run: focusLibrarySearch,
  },

  // Appearance
  {
    id: 'theme.light',
    label: 'Theme: Light',
    group: 'Appearance',
    icon: Sun,
    run: () => useUIStore.getState().setTheme('light'),
  },
  {
    id: 'theme.dark',
    label: 'Theme: Dark',
    group: 'Appearance',
    icon: Moon,
    run: () => useUIStore.getState().setTheme('dark'),
  },
  {
    id: 'theme.system',
    label: 'Theme: System',
    group: 'Appearance',
    icon: Monitor,
    run: () => useUIStore.getState().setTheme('system'),
  },

  // Help
  {
    id: 'help.settings',
    label: 'Settings…',
    group: 'Help',
    icon: Settings,
    shortcut: '⌘,',
    keywords: 'preferences options',
    run: () => useOverlayStore.getState().setSettingsOpen(true),
  },
  {
    id: 'help.shortcuts',
    label: 'Keyboard Shortcuts',
    group: 'Help',
    icon: Keyboard,
    shortcut: '?',
    run: () => useOverlayStore.getState().setShortcutsOpen(true),
  },
  {
    id: 'help.ai',
    label: 'AI Layout Assistant',
    group: 'Help',
    icon: Sparkles,
    keywords: 'generate automatic',
    run: () =>
      toast({
        variant: 'info',
        title: 'AI layouts coming soon',
        description: 'Generated rack layouts are on the roadmap.',
      }),
  },
  {
    id: 'help.camera-help',
    label: 'Viewport Controls Help',
    group: 'Help',
    icon: Camera,
    keywords: 'orbit pan zoom navigate',
    run: () => useViewSettingsStore.getState().toggleHints(),
  },
];
