# Universal Device Import Pipeline

Every rack device — regardless of manufacturer — enters RackForge through
the same deterministic pipeline. Adding a device requires **assets and
metadata only**; no engineering.

## Adding a device

Drop a folder following the convention:

```
public/devices/
  <manufacturer>/
    <device>/
      model.glb        # CAD-style model, true millimeter scale
      thumbnail.webp   # library card image
      metadata.json    # DeviceDefinition (see src/features/devices/deviceSchema.ts)
```

`npm run dev` / `npm run build` regenerate `public/devices/manifest.json`
automatically (`scripts/generate-device-manifest.mjs`), so new folders are
discovered without touching code. `npm run manifest` runs the scan on its
own.

## Pipeline stages

Implemented in `src/features/devices/import/modelImport.ts` and wired
through `DeviceModel.tsx`:

| # | Stage              | Behavior |
|---|--------------------|----------|
| 1 | Read metadata      | `deviceRegistry` loads and validates `metadata.json` (schema issues are logged and the entry is skipped — a bad drop never breaks the app) |
| 2 | Load GLB           | drei cache, Draco decoder self-hosted, per-instance clones |
| 3 | Measure raw bounds | geometry-level AABB in model-local space, millimeters |
| 4 | Detect origin      | `centered` / `base` / `offset`, with size-scaled tolerances |
| 5 | Detect forward     | spec axis matching: width-along-Z models are recognized by comparing both axis assignments against the manufacturer dimensions |
| 6 | Default transform  | quarter-turn (when needed) + translate bounds center to the origin; **scale is always 1** |
| 7 | Metadata override  | an explicit `modelTransform` in metadata wins **verbatim** (needed for what geometry cannot reveal, e.g. a 180° faceplate flip) |
| 8 | Validate dims      | measured vs spec per axis; deviations beyond ±2% raise warnings — models are **never silently scaled** |
| 9 | Register           | the import report lands in `importReportStore` (console warning + debug overlay) |

The pipeline is a pure function of the geometry and the definition: the
same GLB always produces the same final transform.

## Device-local convention

- Origin at the chassis center
- Front face (faceplate) toward **+Z**
- Width along X, height along Y — true millimeter scale (1 unit = 1 m in
  the GLB, measured in mm by the pipeline)

## Mounting (universal)

`src/features/rack/rackMath.ts` owns all placement. Every device mounts
through `devicePlacement()`: front ears flush with the front rail plane
(or rear plane for rear-facing devices), extending inward. There are no
per-device placement code paths and no hardcoded per-device offsets — the
only per-device data is declarative metadata.

Rack profiles (`rackProfiles.ts`) each define external dimensions, front
and rear rail planes, an adjustable rail range, usable depth, a hard
maximum device depth, rear clearance, cable clearance, support-rail and
shelf availability. Racks compute their own geometry; devices never
modify themselves. In auto rail mode the rear rails position themselves
against the deepest installed device.

## Mechanical layer

`src/features/rack/mechanics.ts` decides how every device is physically
carried — one solver, zero device-specific code:

- **Front ears** bolt to the front rail plane (suppressed when the GLB
  models its own via `mechanical.integratedEars`).
- **Rear brackets** carry the tail when it reaches the rear rails
  (within ±25 mm — always true in auto rail mode).
- **Side support rails** carry short chassis in deep racks when the
  profile provides them (`supportRails`).
- **Front-ear cantilever** is the honest fallback — exactly how a 1U
  switch hangs in a real deep rack without rear support.
- **Shelves**: devices with `mountingStandard: 'none'` seat on a shelf
  surface (engine-rendered) when the profile is `shelfCompatible`.

`MechanicalSpec` metadata (all optional, engine derives defaults from
the dimensions): `mountStyle`, `frontMountPlaneMm`, `rearSupportPlaneMm`,
`bottomSupportPlaneMm`, `earThicknessMm`, `earOffsetMm`,
`integratedEars`, `centerOfMassMm`, `railType`. `accessoryKind`
classifies rail accessories (blank/brush panels, shelves, cable
managers, PDUs, patch panels, support brackets) for future tooling.

`analyzeMechanics()` computes pure geometric facts per instance — rear
brackets passing through the rear rail plane, shelves deeper than the
rails, chassis exceeding rail spacing, overlapping chassis volumes. No
warnings are raised; downstream layers decide what to surface.

The visible hardware (`MountingHardware.tsx`) is parametric — a few
boxes and bolt heads per device driven entirely by the solver, so every
manufacturer benefits automatically.

## Capability metadata (declarative only)

`DeviceDefinition` carries forward-looking metadata with **no runtime
behavior yet**: ports (front/rear location, SFP/USB/console/power types,
pitch, rows, speeds, PoE), power connectors and redundancy, cooling
(fans, airflow, ventilation), LCD displays, status LEDs, and lighting
(Etherlighting, per-port link/activity, PoE indication, speed colors,
effects).

These are the architecture hooks for: cable routing, AI rack assistant,
smart validation, power planning, cooling simulation, weight
distribution, install reports, multi-vendor templates, and real-time LED
simulation. Consumers should read them from the registry — never invent
side-channel data.

## Debug mode

Ships inert; query-param gated:

- `?debugBounds` — per device: measured vs expected bounding boxes,
  local origin axes, forward vector, and the import report (transform
  source and values, origin classification, per-axis deviation).
- `?debugDims` — per rack: external depth, rail planes, device depth and
  rear clearance measurement lines.

## Quality rules

1. Real manufacturer dimensions in metadata — always.
2. Standardized CAD-style models, not photogrammetry.
3. Never stretch, rescale, or edit a GLB to make it fit — fix metadata,
   or report the deviation.
4. No device-specific hacks in engine code. If a device needs special
   treatment, it must be expressible as metadata.
