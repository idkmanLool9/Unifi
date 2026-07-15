import { getDevice } from './deviceRegistry';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { toast } from '@/stores/toastStore';

/**
 * Mounts a device in the first free slot and reports the outcome as a
 * toast. Shared by the library preview panel, card context menus and
 * (later) drag & drop.
 */
export function addDeviceToRack(definitionId: string): boolean {
  const definition = getDevice(definitionId);
  const result = useDeviceInstancesStore
    .getState()
    .addDevice(definitionId);

  if (result.ok) {
    const endU = result.startU + (definition?.rackUnits ?? 1) - 1;
    toast({
      variant: 'success',
      title: `${definition?.productName ?? 'Device'} mounted`,
      description:
        result.startU === endU
          ? `Installed at U${result.startU}.`
          : `Installed at U${result.startU}–U${endU}.`,
    });
    return true;
  }

  toast({
    variant: result.reason === 'no-rack' ? 'info' : 'warning',
    title: 'Can’t mount device',
    description: result.message,
  });
  return false;
}
