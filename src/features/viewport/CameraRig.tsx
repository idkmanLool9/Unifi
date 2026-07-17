import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Raycaster, Sphere, Vector2, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import {
  CABLE_TOOL_MIN_DISTANCE,
  nearPlaneFor,
  nearPlaneNeedsUpdate,
} from './cameraFocus';
import { approachCableWork } from './focusActions';
import { useDragStore } from '@/stores/dragStore';
import { useRackStore } from '@/stores/rackStore';
import { useUIStore } from '@/stores/uiStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';
import { rackGeometry, rackHeightFor } from '@/features/rack/rackMath';
import { CAMERA, VIEW_POSES } from '@/lib/constants';
import type { RackConfig, ViewPreset } from '@/types';

/** Overall height of the current rack, profile-aware. */
const currentRackHeight = (rack: RackConfig): number =>
  rackHeightFor(rack.units, rackGeometry(rack.profileId, rack.railSpacingMm));

/** Damping used while the user drives the camera. */
const INTERACTIVE_SMOOTH = 0.18;
/** Damping used for preset/fit transitions — a slower, cinematic glide. */
const TRANSITION_SMOOTH = 0.5;

interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Camera pose for a view preset, framed around the actual rack. A 6U rack
 * is presented as tightly as a 42U — the hero view sits slightly above
 * mid-height on a three-quarter angle, like a product photograph.
 */
function poseForView(view: ViewPreset): CameraPose {
  const rack = useRackStore.getState().rack;
  if (!rack) {
    const p = VIEW_POSES[view];
    return { position: [...p.position], target: [...p.target] };
  }

  const h = currentRackHeight(rack);
  const cy = h * 0.5;
  const d = Math.max(1.9, h * 1.3);
  const face = Math.max(2.4, h * 1.7);

  switch (view) {
    case 'perspective':
      return {
        position: [d * 0.85, cy + h * 0.34, d * 1.15],
        target: [0, cy * 0.9, 0],
      };
    case 'top':
      return {
        position: [0, h + Math.max(1.6, h * 0.9), 0.0001],
        target: [0, 0, 0],
      };
    case 'front':
      return { position: [0, cy, face], target: [0, cy, 0] };
    case 'back':
      return { position: [0, cy, -face], target: [0, cy, 0] };
    case 'left':
      return { position: [-face, cy, 0], target: [0, cy, 0] };
    case 'right':
      return { position: [face, cy, 0], target: [0, cy, 0] };
  }
}

/** Bounding sphere for "fit view": wraps the rack, or the stage origin. */
function getFitSphere(): Sphere {
  const rack = useRackStore.getState().rack;
  if (!rack) return new Sphere(new Vector3(0, 1, 0), 4.5);
  const h = currentRackHeight(rack);
  const radius = Math.max(h * 0.62, 0.85);
  return new Sphere(new Vector3(0, h / 2, 0), radius);
}

/**
 * Owns the viewport camera: smooth damped navigation via camera-controls,
 * cinematic transitions for view-preset commands dispatched from the UI,
 * and live FOV sync from the view settings store.
 */
export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);

  const command = useViewportStore((s) => s.command);
  const setActiveView = useViewportStore((s) => s.setActiveView);
  const fov = useViewSettingsStore((s) => s.fov);
  const dragging = useDragStore(
    (s) => s.phase === 'dragging' || s.orbitSuspended,
  );

  // A drag gesture owns the pointer: orbit pauses for exactly that
  // gesture (including the pre-threshold press on a device) and resumes
  // when the drag ends, cancels, or turns out to be a plain click.
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) controls.enabled = !dragging;
  }, [dragging]);

  // Keep the camera's FOV in sync with the inspector slider.
  useEffect(() => {
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);

  // Camera feel preferences: CAD-style dolly-to-cursor plus speed and
  // inversion multipliers, applied to the controls in place.
  const zoomSpeed = useViewSettingsStore((s) => s.zoomSpeed);
  const orbitSpeed = useViewSettingsStore((s) => s.orbitSpeed);
  const panSpeed = useViewSettingsStore((s) => s.panSpeed);
  const invertZoom = useViewSettingsStore((s) => s.invertZoom);
  const zoomToPointer = useViewSettingsStore((s) => s.zoomToPointer);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.dollyToCursor = zoomToPointer;
    controls.dollySpeed = zoomSpeed * (invertZoom ? -1 : 1);
    controls.azimuthRotateSpeed = orbitSpeed;
    controls.polarRotateSpeed = orbitSpeed;
    controls.truckSpeed = 2 * panSpeed;
  }, [zoomSpeed, orbitSpeed, panSpeed, invertZoom, zoomToPointer]);

  // Cable Tool: allow much closer dolly (individual contacts stay
  // readable without clipping) and, on activation, glide the selected
  // device's panel into comfortable picking range — same viewing angle,
  // no snap, and the user keeps full control throughout.
  const cableTool = useUIStore((s) => s.activeTool === 'cable');
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.minDistance = cableTool
      ? CABLE_TOOL_MIN_DISTANCE
      : CAMERA.minDistance;
    if (cableTool) {
      const p = controls.getPosition(new Vector3());
      approachCableWork([p.x, p.y, p.z]);
    }
  }, [cableTool]);

  // Dynamic near plane: millimeter-scale near for connector close-ups,
  // conservative depth precision at rack range. The projection matrix
  // only updates when the value moves meaningfully.
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof PerspectiveCamera)) return;
    const next = nearPlaneFor(controls.distance);
    if (nearPlaneNeedsUpdate(camera.near, next)) {
      camera.near = next;
      camera.updateProjectionMatrix();
    }
  });

  // Middle-click sets the orbit pivot on whatever is under the pointer.
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const element = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      const controls = controlsRef.current;
      if (!controls) return;
      const rect = element.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(scene.children, true)[0];
      if (hit) {
        controls.setOrbitPoint(hit.point.x, hit.point.y, hit.point.z);
        setActiveView('custom');
      }
    };
    element.addEventListener('pointerdown', onPointerDown);
    return () => element.removeEventListener('pointerdown', onPointerDown);
  }, [gl, camera, scene, setActiveView]);

  // A persisted rack should be presented from the hero angle on load.
  const framedOnce = useRef(false);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || framedOnce.current) return;
    framedOnce.current = true;
    if (useRackStore.getState().rack) {
      const { position, target } = poseForView('perspective');
      void controls.setLookAt(...position, ...target, false);
    }
  }, []);

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

    const glide = (move: () => Promise<unknown>) => {
      controls.smoothTime = TRANSITION_SMOOTH;
      void move().finally(() => {
        controls.smoothTime = INTERACTIVE_SMOOTH;
      });
    };

    const flyTo = (view: ViewPreset) => {
      const { position, target } = poseForView(view);
      glide(() => controls.setLookAt(...position, ...target, true));
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
        glide(() => controls.fitToSphere(getFitSphere(), true));
        setActiveView('custom');
        break;
      case 'focus':
        // Deterministic pose computed by the focus actions.
        glide(() =>
          controls.setLookAt(...command.position, ...command.target, true),
        );
        setActiveView('custom');
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
      smoothTime={INTERACTIVE_SMOOTH}
      draggingSmoothTime={0.06}
    />
  );
}
