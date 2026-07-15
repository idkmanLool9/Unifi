# RackForge

A professional, brand-independent 3D rack design application. Build server
racks in full 3D by dragging hardware into rack units.

## Tech stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| UI         | React 19 · TypeScript · Vite            |
| 3D         | Three.js · React Three Fiber · Drei     |
| Styling    | Tailwind CSS v4 (CSS-first tokens)      |
| State      | Zustand                                 |
| Animation  | Framer Motion                           |
| Backend    | Supabase _(planned)_                    |
| Desktop    | Tauri _(planned)_                       |

## Getting started

```bash
npm install
npm run dev        # start dev server
npm run build      # typecheck + production build
npm run typecheck  # typecheck only
npm run preview    # preview production build
```

## Project structure

```
src/
├── app/                  # Composition root: App, router, providers
│   └── providers/        # ThemeProvider (theme ↔ DOM sync)
├── pages/                # Route-level components (EditorPage, NotFound)
├── components/
│   ├── layout/           # App chrome: toolbar, sidebar, status bar
│   └── ui/               # Reusable primitives: IconButton, Tooltip, Switch,
│                         # Slider, CollapsibleSection, …
├── features/
│   ├── inspector/        # Right-hand inspector: scene sections + rack
│   │                     # sections (shown when the rack is selected)
│   ├── rack/             # Parametric EIA-310 rack model, finishes,
│   │                     # canvas rail textures, selection, welcome flow
│   └── viewport/         # All React Three Fiber code (canvas, scene,
│                         # lighting, camera rig, nav widget, stats probe)
├── stores/               # Zustand stores (uiStore, viewSettingsStore,
│                         # rackStore persisted; viewportStore transient)
├── hooks/                # Shared hooks (useResolvedTheme, useEditorShortcuts)
├── lib/                  # Utilities and constants (cn, camera config)
├── styles/               # Global CSS + design tokens (light/dark themes)
└── types/                # Shared TypeScript types
```

### Architecture notes

- **Design tokens** live as semantic CSS variables in `styles/globals.css`
  and are mapped into Tailwind utilities via `@theme inline`. Light/dark
  theming is a single `data-theme` attribute flip on `<html>`; a pre-paint
  script in `index.html` prevents theme flash.
- **State** is split by volatility: `uiStore` (theme, panels, active tool)
  and `viewSettingsStore` (grid, snap, FOV, lighting) are persisted to
  localStorage; `viewportStore` (FPS, draw calls, camera commands) is
  transient and written from inside the render loop on a throttle so
  per-frame updates never re-render React trees.
- **Camera commands**: UI chrome (nav widget, inspector quick actions)
  dispatches nonce-stamped commands through `viewportStore`; the
  `CameraRig` inside the canvas consumes them and animates transitions
  via `camera-controls`.
- **3D isolation**: everything WebGL lives under `features/viewport/`.
  The rest of the app talks to it only through stores, so future features
  (rack model, drag & drop) plug in without touching the shell.
- **Rendering**: the canvas is transparent over a CSS gradient backdrop
  (with a stage glow pooled under the rack), so theme switches don't
  touch GL state. Image-based lighting comes from a procedural
  light-former studio (no network HDR); N8AO provides screen-space
  ambient occlusion with MSAA (toggleable in View settings). The heavy
  three.js stack is split into its own bundle chunk.
- **Rack materials** are `MeshPhysicalMaterial` sets built per finish:
  painted finishes get a powder-coat response (noise-modulated roughness,
  orange-peel bump, soft clearcoat); bare metal leans on metalness and
  environment reflections. Rail unit numbers and EIA-310 cage-nut holes
  are drawn into canvas textures per rail.

## Keyboard shortcuts

| Key | Action                |
| --- | --------------------- |
| `V` | Select tool           |
| `H` | Pan tool              |
| `O` | Orbit tool            |
| `[` | Toggle library panel  |
| `]` | Toggle inspector      |
| `G` | Toggle floor grid     |
| `F` | Fit view              |
| `Esc` | Clear selection     |

## Roadmap

Done — M1: application foundation (shell, theming, routing, stores,
3D viewport). M2: premium UI polish (tooltips, glass widgets, camera
presets, live view settings). M3: first rack experience (parametric
EIA-310 open-frame rack, welcome/create flow, selection, rack
inspector). M4: visual realism (L-profile steel construction,
powder-coat materials, studio IBL, ambient occlusion, cinematic
camera). Upcoming: device library, drag & drop, validation, cable
routing, pricing, PDF export, AI-generated layouts, collaboration.
