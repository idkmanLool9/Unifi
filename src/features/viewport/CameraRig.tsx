import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import { useRackStore } from '@/stores/rackStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { rackHeight } from '@/features/rack/rackConstants';
import { CAMERA, VIEW_POSES } from '@/lib/constants';
import type { ViewPreset } from '@/types';

/** Bounding sphere for "fit view": wraps the rack, or the stage origin. */
function getFitSphere(): Sphere {
  const rack = useRackStore.getState().rack;
  if (!rack) return new Sphere(new Vector3(0, 1, 0), 4.5);
  const h = rackHeight(rack.units);
  const radius = Math.max(h * 0.62, 0.85);
  return new Sphere(new Vector3(0, h / 2, 0), radius);
}

/**
 * Owns the viewport camera: smooth damped navigation via camera-controls,
 * animated transitions for view-preset commands dispatched from the UI,
 * and live FOV sync from the view settings store.
 */
export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);

  const command = useViewportStore((s) => s.command);
  const setActiveView = useViewportStore((s) => s.setActiveView);
  const fov = useViewSettingsStore((s) => s.fov);

  // Keep the camera's FOV in sync with the inspector slider.
  useEffect(() => {
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);

  // Any manual orbit means we're no longer in a named preset.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onUserControl = () => setActiveView('custom');
    controls.addEventListener('controlstart', onUserControl);
    return () => controls.removeEventListener('controlstart', onUserControl);
  }, [setActiveView]);

  // Consume one-shot camera commands from the UI chrome.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!command || !controls) return;

    const flyTo = (view: ViewPreset) => {
      const { position, target } = VIEW_POSES[view];
      void controls.setLookAt(...position, ...target, true);
      setActiveView(view);
    };

    switch (command.type) {
      case 'preset':
        flyTo(command.view);
        break;
      case 'reset':
        flyTo('perspective');
        break;
      case 'fit':
        void controls.fitToSphere(getFitSphere(), true);
        break;
    }
  }, [command, setActiveView]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.02}
      smoothTime={0.18}
      draggingSmoothTime={0.06}
    />
  );
}
