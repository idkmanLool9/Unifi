import { getDevice } from './deviceRegistry';
import {
  devicePlacement,
  surfaceDevicePlacement,
  type DevicePose,
  type PlacedDevice,
  type RackGeometry,
} from '@/features/rack/rackMath';

/**
 * The single world-pose authority for mounted instances. Rail-mounted
 * devices resolve through devicePlacement; devices standing on a shelf
 * resolve relative to their shelf (and disappear with it). Everything
 * that positions a device — rendering, cables, focus, ghosts — goes
 * through here so shelves, offsets and rotation stay consistent.
 */
/**
 * Pose override for cable-endpoint resolution: undefined for
 * rail-mounted devices (anchors derives their pose itself), the
 * shelf-relative pose for devices standing on a shelf.
 */
export function poseForEndpoint(
  instance: PlacedDevice,
  instances: readonly PlacedDevice[],
  geometry: RackGeometry,
): DevicePose | undefined {
  if (!instance.surface) return undefined;
  return instancePose(instance, instances, geometry) ?? undefined;
}

export function instancePose(
  instance: PlacedDevice,
  instances: readonly PlacedDevice[],
  geometry: RackGeometry,
): DevicePose | null {
  const definition = getDevice(instance.definitionId);
  if (!definition) return null;
  if (instance.surface) {
    const shelf = instances.find((i) => i.id === instance.surface!.shelfId);
    const shelfDefinition = shelf && getDevice(shelf.definitionId);
    if (!shelf || !shelfDefinition) return null;
    return surfaceDevicePlacement(
      definition,
      instance.surface,
      shelfDefinition,
      shelf,
      geometry,
    );
  }
  return devicePlacement(definition, instance.startU, instance.facing, geometry);
}
