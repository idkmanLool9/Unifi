import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Subpath deployments (GitHub Pages serves at /<repo>/) set
  // VITE_BASE_PATH in CI; local dev and root deployments default to '/'.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy 3D stack in its own chunk so the UI shell loads fast.
        manualChunks(id: string): string | undefined {
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three')
          ) {
            return 'three';
          }
          return undefined;
        },
      },
    },
  },
});
