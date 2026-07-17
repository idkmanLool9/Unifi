import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './providers/ThemeProvider';
import { loadExternalDefinitions } from '@/features/devices/deviceRegistry';
import { applyPersistedAuthoredDevices } from '@/stores/authoredDevicesStore';

export function App() {
  // Startup definition order (later wins): built-ins → external
  // metadata from /public/devices → definitions authored in this
  // browser via the Device Authoring mode.
  useEffect(() => {
    void loadExternalDefinitions().finally(() => {
      applyPersistedAuthoredDevices();
    });
  }, []);

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
