#!/usr/bin/env node
/**
 * Device auto-discovery. Scans public/devices/<manufacturer>/<device>/
 * for metadata.json files and regenerates public/devices/manifest.json.
 * Runs before `dev` and `build` (npm pre-hooks), so dropping a device
 * folder — model.glb + metadata.json + thumbnail.webp — is all it takes
 * to register a new device. Output is sorted for deterministic builds.
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const devicesDir = join(root, 'public', 'devices');
const manifestPath = join(devicesDir, 'manifest.json');

const listDirs = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).filter((name) => {
        try {
          return statSync(join(dir, name)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];

const devices = [];
for (const manufacturer of listDirs(devicesDir)) {
  for (const device of listDirs(join(devicesDir, manufacturer))) {
    const folder = `${manufacturer}/${device}`;
    const metadataPath = join(devicesDir, manufacturer, device, 'metadata.json');
    if (!existsSync(metadataPath)) continue;
    try {
      JSON.parse(readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      console.warn(`[manifest] skipping ${folder}: metadata.json is not valid JSON (${error.message})`);
      continue;
    }
    devices.push(folder);
  }
}
devices.sort();

const next = JSON.stringify({ devices }, null, 2) + '\n';
const current = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
if (next !== current) {
  writeFileSync(manifestPath, next);
  console.log(`[manifest] ${devices.length} device(s): ${devices.join(', ') || '(none)'}`);
} else {
  console.log(`[manifest] up to date (${devices.length} device(s))`);
}
