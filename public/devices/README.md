# Device assets

Every device follows the same folder convention:

```
public/devices/<manufacturer>/<device-slug>/
├── model.glb        # Real 3D model (PBR materials preserved as-authored)
├── thumbnail.webp   # Catalog thumbnail
└── metadata.json    # Device definition (validated at load)
```

## How loading works

- `manifest.json` (in this folder) lists device folders to load. Each
  entry's `metadata.json` is fetched, validated against the strict device
  schema, and registered — overriding any bundled definition with the
  same `id`.
- `model.glb` and `thumbnail.webp` are optional. RackForge probes for
  them at runtime: while a file is absent, a polished parametric
  placeholder (built from the metadata's real dimensions) renders
  instead. **Drop the file in and reload — no code changes.**
- `modelTransform` in metadata (scale / rotationDeg / offsetMm) corrects
  the GLB's scale, orientation and origin. The convention is: origin at
  the chassis center, front face toward +Z, real-world meters. The source
  GLB is never modified.

## Adding a new device

1. Create `public/devices/<manufacturer>/<slug>/metadata.json`
   (copy `ubiquiti/dream-machine-pro/metadata.json` as a template).
2. Add `"<manufacturer>/<slug>"` to `manifest.json`.
3. Optionally add `model.glb` and `thumbnail.webp` whenever ready.

New manufacturers need no registration — brand tiles fall back to a
generated monogram until a visual identity is added.
