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
│   ├── layout/           # App chrome: toolbar, sidebar, inspector, status bar
│   └── ui/               # Reusable primitives: IconButton, EmptyState, …
├── features/
│   └── viewport/         # All React Three Fiber code (canvas, scene,
│                         # lighting, camera, stats probe)
├── stores/               # Zustand stores (uiStore persisted, viewportStore transient)
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
  is persisted to localStorage; `viewportStore` (FPS, draw calls) is
  transient and written from inside the render loop on a throttle so
  per-frame updates never re-render React trees.
- **3D isolation**: everything WebGL lives under `features/viewport/`.
  The rest of the app talks to it only through stores, so future features
  (rack model, drag & drop) plug in without touching the shell.
- **Rendering**: the canvas is transparent over a CSS gradient backdrop,
  so theme switches don't touch GL state. The heavy three.js stack is
  split into its own bundle chunk.

## Keyboard shortcuts

| Key | Action                |
| --- | --------------------- |
| `V` | Select tool           |
| `H` | Pan tool              |
| `O` | Orbit tool            |
| `[` | Toggle library panel  |
| `]` | Toggle inspector      |

## Roadmap

Milestone 1 (this): application foundation — shell, theming, routing,
stores, 3D viewport. Upcoming: rack rendering, device library,
drag & drop, validation, cable routing, pricing, PDF export,
AI-generated layouts, collaboration.
