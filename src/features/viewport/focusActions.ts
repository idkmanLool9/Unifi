import {
  cableFocusPose,
  deviceFocusPose,
  faceDetailPose,
  portFocusPose,
  PORT_FOCUS_STANDOFF,
  type CameraPose,
} from './cameraFocus';
import { resolveEndpoint } from '@/features/cables/anchors';
import { getDevice } from '@/features/devices/deviceRegistry';
import { railHeight } from '@/features/rack/rackConstants';
import { deepestDeviceDepthMm, rackGeometryFor } from '@/features/rack/rackMath';
import { useCableStore, type CableEnd } from '@/stores/cableStore';
import { useCableToolStore } from '@/stores/cableToolStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

/**
 * Focus actions: translate "focus this thing" into a deterministic
 * camera pose (via the pure cameraFocus math) and dispatch it to the
 * rig. Shared by F-key framing, double-clicks, context menus and the
 * command palette. Every action is safe to call with nothing to focus —
 * it falls back to framing the rack.
 */

function currentContext() {
  const rack = useRackStore.getState().rack;
  if (!rack) return null;
  const instances = useDeviceInstancesStore.getState().instances;
  const geometry = rackGeometryFor(
    rack,
    deepestDeviceDepthMm(instances, getDevice),
  );
  return {
    rack,
    instances,
    geometry,
    fov: useViewSettingsStore.getState().fov,
  };
}

function dispatch(pose: CameraPose): void {
  useViewportStore.getState().dispatchCamera({
    type: 'focus',
    position: pose.position,
    target: pose.target,
  });
}

const fitRack = (): void =>
  useViewportStore.getState().dispatchCamera({ type: 'fit' });

/** Focus a mounted device from its faceplate side. */
export function focusDevice(instanceId: string, closeUp = false): void {
  const ctx = currentContext();
  if (!ctx) return;
  const instance = ctx.instances.find((i) => i.id === instanceId);
  const definition = instance && getDevice(instance.definitionId);
  if (!instance || !definition) return fitRack();
  const pose = deviceFocusPose(
    definition,
    instance,
    ctx.geometry,
    ctx.rack.orientation,
    ctx.fov,
  );
  if (closeUp) {
    // Halve the standoff along the view direction.
    pose.position = [
      (pose.position[0] + pose.target[0]) / 2,
      (pose.position[1] + pose.target[1]) / 2,
      (pose.position[2] + pose.target[2]) / 2,
    ];
  }
  dispatch(pose);
}

/** Close-up on a single physical port (front ports from the front). */
export function focusPort(end: CableEnd, closeUp = false): void {
  const ctx = currentContext();
  if (!ctx) return;
  const instance = ctx.instances.find((i) => i.id === end.deviceInstanceId);
  const definition = instance && getDevice(instance.definitionId);
  if (!instance || !definition) return fitRack();
  const endpoint = resolveEndpoint(definition, instance, ctx.geometry, end.portRef);
  if (!endpoint) return fitRack();
  dispatch(
    portFocusPose(
      endpoint,
      ctx.rack.orientation,
      closeUp ? PORT_FOCUS_STANDOFF * 0.6 : PORT_FOCUS_STANDOFF,
    ),
  );
}

/** Frame a cable via its endpoints' anchors. */
export function focusCable(cableId: string): void {
  const ctx = currentContext();
  if (!ctx) return;
  const cable = useCableStore.getState().cables.find((c) => c.id === cableId);
  if (!cable) return fitRack();
  const ends = [cable.source, cable.destination]
    .map((end) => {
      const instance = ctx.instances.find((i) => i.id === end.deviceInstanceId);
      const definition = instance && getDevice(instance.definitionId);
      return instance && definition
        ? resolveEndpoint(definition, instance, ctx.geometry, end.portRef)
        : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (ends.length === 0) return fitRack();
  dispatch(
    cableFocusPose(
      ends.map((e) => e.anchor),
      ctx.rack.orientation,
      ctx.fov,
    ),
  );
}

/**
 * Frame whatever is selected (device, cable, pending cable source, or
 * the rack). Bound to F and the "Frame selection" actions.
 */
export function frameSelection(closeUp = false): void {
  const pendingSource = useCableToolStore.getState().sourceEnd;
  if (pendingSource) return focusPort(pendingSource, closeUp);

  const selection = useSelectionStore.getState().selection;
  if (selection?.kind === 'device') {
    return focusDevice(selection.instanceId, closeUp);
  }
  if (selection?.kind === 'cable') return focusCable(selection.cableId);
  fitRack();
}

/** Straight-on detail view of the rack's front or rear rail face. */
export function faceDetail(face: 'front' | 'rear'): void {
  const ctx = currentContext();
  if (!ctx) return;
  dispatch(
    faceDetailPose(
      ctx.geometry,
      ctx.geometry.railBaseYM + railHeight(ctx.rack.units),
      face,
      ctx.rack.orientation,
      ctx.fov,
    ),
  );
}
