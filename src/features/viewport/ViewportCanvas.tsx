import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Box,
  Eye,
  Focus,
  Grid3x3,
  MousePointer2,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import { Scene } from './Scene';
import { ViewportHint } from './ViewportHint';
import { ViewportNavWidget } from './ViewportNavWidget';
import { WelcomeOverlay } from '@/features/rack/WelcomeOverlay';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useCableToolStore } from '@/stores/cableToolStore';
import { useMenuStore, type MenuEntry } from '@/stores/menuStore';
import { useUIStore } from '@/stores/uiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { CAMERA } from '@/lib/constants';

/** Pointer travel (px) below which a pointerup still counts as a click. */
const CLICK_DRAG_TOLERANCE = 5;

/**
 * The 3D editor viewport. The WebGL canvas is transparent and sits on a
 * CSS gradient backdrop with a soft vignette, so theme switching never
 * needs to touch GL state. Floating chrome (nav widget, hints, welcome
 * card) is layered above the canvas.
 */
export function ViewportCanvas() {
  const theme = useResolvedTheme();
  const hintsVisible = useViewSettingsStore((s) => s.hintsVisible);
  const hasRack = useRackStore((s) => s.rack !== null);
  const cableTool = useUIStore((s) => s.activeTool === 'cable');
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rackState = useRackStore.getState();
    const viewport = useViewportStore.getState();
    const view = useViewSettingsStore.getState();
    const overlays = useOverlayStore.getState();

    const cameraEntries: MenuEntry[] = [
      {
        id: 'fit',
        label: 'Fit view',
        icon: Focus,
        shortcut: 'F',
        action: () => viewport.dispatchCamera({ type: 'fit' }),
      },
      {
        id: 'reset',
        label: 'Reset camera',
        icon: RotateCcw,
        action: () => viewport.dispatchCamera({ type: 'reset' }),
      },
      {
        id: 'top',
        label: 'Top view',
        icon: Square,
        action: () =>
          viewport.dispatchCamera({ type: 'preset', view: 'top' }),
      },
      { separator: true },
      {
        id: 'grid',
        label: view.gridVisible ? 'Hide floor grid' : 'Show floor grid',
        icon: Grid3x3,
        shortcut: 'G',
        action: view.toggleGrid,
      },
      {
        id: 'hints',
        label: view.hintsVisible ? 'Hide viewport hints' : 'Show viewport hints',
        icon: Eye,
        action: view.toggleHints,
      },
    ];

    const selectionState = useSelectionStore.getState();
    const rackSelected = selectionState.selection?.kind === 'rack';
    const rackEntries: MenuEntry[] = rackState.rack
      ? [
          { separator: true },
          {
            id: 'select-rack',
            label: rackSelected ? 'Deselect rack' : 'Select rack',
            icon: MousePointer2,
            action: () =>
              rackSelected
                ? selectionState.clear()
                : selectionState.selectRack(),
          },
          {
            id: 'frame-rack',
            label: 'Frame rack',
            icon: Box,
            action: () => viewport.dispatchCamera({ type: 'fit' }),
          },
          {
            id: 'delete-rack',
            label: 'Delete rack…',
            icon: Trash2,
            danger: true,
            action: () => overlays.setConfirmDeleteRackOpen(true),
          },
        ]
      : [];

    useMenuStore.getState().openMenu(e.clientX, e.clientY, [
      ...cameraEntries,
      ...rackEntries,
    ]);
  };

  return (
    <div
      className="viewport-backdrop relative min-w-0 flex-1"
      style={{ cursor: cableTool ? 'crosshair' : undefined }}
      onContextMenu={onContextMenu}
      onPointerDown={(e) => {
        pointerDownAt.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          position: [...CAMERA.position],
          fov: CAMERA.fov,
          near: CAMERA.near,
          far: CAMERA.far,
        }}
        className="!absolute inset-0"
        onPointerMissed={(e) => {
          // Only deselect on a true click — orbiting the camera also ends
          // with a pointerup, which must not clear the selection.
          const down = pointerDownAt.current;
          const moved =
            down &&
            Math.hypot(e.clientX - down.x, e.clientY - down.y) >
              CLICK_DRAG_TOLERANCE;
          if (moved) return;
          // A click on empty space first cancels a pending cable.
          const cableTool = useCableToolStore.getState();
          if (cableTool.sourceEnd) {
            cableTool.reset();
            return;
          }
          useSelectionStore.getState().clear();
        }}
      >
        <Scene theme={theme} />
      </Canvas>

      <div className="viewport-vignette pointer-events-none absolute inset-0" />

      {hasRack ? (
        <>
          <ViewportNavWidget />
          {hintsVisible && <ViewportHint />}
        </>
      ) : (
        <WelcomeOverlay />
      )}
    </div>
  );
}
