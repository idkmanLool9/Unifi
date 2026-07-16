import { Outlet } from 'react-router-dom';
import { TopToolbar } from './TopToolbar';
import { StatusBar } from './StatusBar';
import { ContextMenuHost } from '@/components/ui/ContextMenuHost';
import { ToastHost } from '@/components/ui/ToastHost';
import { CommandPalette } from '@/features/commands/CommandPalette';
import { SettingsDialog } from '@/features/overlays/SettingsDialog';
import { ShortcutsDialog } from '@/features/overlays/ShortcutsDialog';
import { ConfirmDeleteRackDialog } from '@/features/overlays/ConfirmDeleteRackDialog';
import { ConfirmDeleteDeviceDialog } from '@/features/overlays/ConfirmDeleteDeviceDialog';
import { ConnectionsDialog } from '@/features/overlays/ConnectionsDialog';

/**
 * Global application chrome: toolbar on top, status bar at the bottom,
 * the active route filling the space between, and app-level overlays
 * (command palette, dialogs, context menu, toasts) mounted once.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopToolbar />
      <main className="flex min-h-0 flex-1">
        <Outlet />
      </main>
      <StatusBar />

      <CommandPalette />
      <SettingsDialog />
      <ShortcutsDialog />
      <ConfirmDeleteRackDialog />
      <ConfirmDeleteDeviceDialog />
      <ConnectionsDialog />
      <ContextMenuHost />
      <ToastHost />
    </div>
  );
}
