import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './providers/ThemeProvider';
import { loadExternalDefinitions } from '@/features/devices/deviceRegistry';

export function App() {
  // Pick up device definitions dropped into /public/devices at startup.
  useEffect(() => {
    void loadExternalDefinitions();
  }, []);

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
