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
export function requestRemoveDevice(instanceId: string): void {
  const cables = cablesForDevice(useCableStore.getState().cables, instanceId);
  if (cables.length > 0) {
    useOverlayStore.getState().setConfirmDeleteDevice(instanceId);
    return;
  }
  removeDeviceAndCables(instanceId);
}

/** The commit path: removes the device and every attached cable. */
export function removeDeviceAndCables(instanceId: string): void {
  const store = useDeviceInstancesStore.getState();
  const instance = store.instances.find((i) => i.id === instanceId);
  const name =
    (instance && getDevice(instance.definitionId)?.productName) ?? 'Device';
  const removedCables = useCableStore.getState().removeForDevice(instanceId);
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
