import { motion } from 'framer-motion';
import { Unplug } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { removeDeviceAndCables } from '@/features/devices/removeDeviceAction';
import { getDevice } from '@/features/devices/deviceRegistry';
import { CABLE_CATALOG } from '@/features/cables/cableCatalog';
import { useCableStore, cablesForDevice } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useSelectionStore } from '@/stores/selectionStore';

/**
 * Cable-aware device deletion. Lists every affected cable; only an
 * explicit confirmation removes the device together with its cables —
 * endpoints are never silently orphaned.
 */
export function ConfirmDeleteDeviceDialog() {
  const instanceId = useOverlayStore((s) => s.confirmDeleteDevice);
  const setInstanceId = useOverlayStore((s) => s.setConfirmDeleteDevice);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const cables = useCableStore((s) => s.cables);

  const instance = instances.find((i) => i.id === instanceId);
  const definition = instance ? getDevice(instance.definitionId) : undefined;
  const affected = instanceId ? cablesForDevice(cables, instanceId) : [];

  const close = () => setInstanceId(null);
  const confirm = () => {
    if (instanceId) {
      removeDeviceAndCables(instanceId);
      const selection = useSelectionStore.getState();
      if (
        selection.selection?.kind === 'device' &&
        selection.selection.instanceId === instanceId
      ) {
        selection.clear();
      }
    }
    close();
  };

  const remoteName = (deviceInstanceId: string): string => {
    const remote = instances.find((i) => i.id === deviceInstanceId);
    return (remote && getDevice(remote.definitionId)?.productName) ?? 'Device';
  };

  return (
    <Dialog open={instanceId !== null} onClose={close} width={420}>
      <div className="p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-danger/12">
          <Unplug className="size-4.5 text-danger" strokeWidth={1.75} />
        </div>
        <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight">
          Remove “{definition?.productName ?? 'device'}” and its cables?
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-secondary">
          {affected.length} cable{affected.length === 1 ? ' is' : 's are'}{' '}
          connected to this device and will be removed with it.
        </p>
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto">
          {affected.map((cable) => {
            const otherEnd =
              cable.source.deviceInstanceId === instanceId
                ? cable.destination
                : cable.source;
            return (
              <li
                key={cable.id}
                className="flex items-center justify-between rounded-md bg-surface-raised px-2 py-1 text-[11px]"
              >
                <span className="truncate text-secondary">
                  {CABLE_CATALOG[cable.type].name} →{' '}
                  {remoteName(otherEnd.deviceInstanceId)} · {otherEnd.portRef}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={close}
            className="h-8 rounded-[9px] border border-edge px-3.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={confirm}
            className="h-8 rounded-[9px] bg-danger px-3.5 text-xs font-medium text-white transition-colors hover:bg-danger/85"
          >
            Remove device + {affected.length} cable
            {affected.length === 1 ? '' : 's'}
          </motion.button>
        </div>
      </div>
    </Dialog>
  );
}
