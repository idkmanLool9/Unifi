import { Outlet } from 'react-router-dom';
import { TopToolbar } from './TopToolbar';
import { StatusBar } from './StatusBar';

/**
 * Global application chrome: toolbar on top, status bar at the bottom,
 * and the active route (editor, future pages) filling the space between.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopToolbar />
      <main className="flex min-h-0 flex-1">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}
