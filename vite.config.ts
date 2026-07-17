import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

/**
 * Dev-only writer for the Device Authoring mode: "Save Ports" POSTs the
 * authored definition here and it lands directly in public/devices/
 * (metadata.json + manifest entry) — no manual file handling. The
 * endpoint only exists on the dev server; static deployments simply
 * don't have it and saving falls back to browser persistence.
 */
function deviceAuthoringWriter(): Plugin {
  return {
    name: 'rackforge-device-authoring-writer',
    configureServer(server) {
      server.middlewares.use('/__rackforge/save-device', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk));
        req.on('end', () => {
          res.setHeader('content-type', 'application/json');
          try {
            const { path, metadata } = JSON.parse(body) as {
              path: string;
              metadata: unknown;
            };
            if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(path)) {
              throw new Error(`invalid device path: ${path}`);
            }
            const root = fileURLToPath(
              new URL('./public/devices', import.meta.url),
            );
            const file = join(root, path, 'metadata.json');
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, JSON.stringify(metadata, null, 2) + '\n');

            const manifestFile = join(root, 'manifest.json');
            const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
              devices: string[];
            };
            if (!manifest.devices.includes(path)) {
              manifest.devices.push(path);
              writeFileSync(
                manifestFile,
                JSON.stringify(manifest, null, 2) + '\n',
              );
            }
            res.end(
              JSON.stringify({
                ok: true,
                file: `public/devices/${path}/metadata.json`,
              }),
            );
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Subpath deployments (GitHub Pages serves at /<repo>/) set
  // VITE_BASE_PATH in CI; local dev and root deployments default to '/'.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), deviceAuthoringWriter()],
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
