import { getDevice } from './deviceRegistry';
import { useCableStore, cablesForDevice } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { toast } from '@/stores/toastStore';

/**
 * Safe device removal. A device with attached cables is never deleted
 * silently: a confirmation dialog lists the affected cables, and only
 * an explicit user choice removes the device together with its cables.
 * Cable endpoints are never orphaned.
 */
/** The instance plus any devices standing on it (shelf children). */
const withShelfChildren = (instanceId: string): string[] => {
  const instances = useDeviceInstancesStore.getState().instances;
  return [
    instanceId,
    ...instances
      .filter((i) => i.surface?.shelfId === instanceId)
      .map((i) => i.id),
  ];
};

export function requestRemoveDevice(instanceId: string): void {
  const cableStore = useCableStore.getState();
  const cables = withShelfChildren(instanceId).flatMap((id) =>
    cablesForDevice(cableStore.cables, id),
  );
  if (cables.length > 0) {
    useOverlayStore.getState().setConfirmDeleteDevice(instanceId);
    return;
  }
  removeDeviceAndCables(instanceId);
}

/** The commit path: removes the device (and any devices standing on
 *  it) together with every attached cable. */
export function removeDeviceAndCables(instanceId: string): void {
  const store = useDeviceInstancesStore.getState();
  const instance = store.instances.find((i) => i.id === instanceId);
  const name =
    (instance && getDevice(instance.definitionId)?.productName) ?? 'Device';
  const removedCables = withShelfChildren(instanceId).flatMap((id) =>
    useCableStore.getState().removeForDevice(id),
  );
  store.removeDevice(instanceId);
  toast({
    variant: 'success',
    title: `${name} removed`,
    description:
      removedCables.length > 0
        ? `${removedCables.length} attached cable${removedCables.length === 1 ? '' : 's'} removed with it.`
        : undefined,
  });
}
