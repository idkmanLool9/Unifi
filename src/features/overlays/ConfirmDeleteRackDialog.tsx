import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useOverlayStore } from '@/stores/overlayStore';
import { useRackStore } from '@/stores/rackStore';
import { toast } from '@/stores/toastStore';

export function ConfirmDeleteRackDialog() {
  const open = useOverlayStore((s) => s.confirmDeleteRackOpen);
  const setOpen = useOverlayStore((s) => s.setConfirmDeleteRackOpen);
  const rack = useRackStore((s) => s.rack);
  const deleteRack = useRackStore((s) => s.deleteRack);

  const confirm = () => {
    const name = rack?.name ?? 'Rack';
    deleteRack();
    setOpen(false);
    toast({
      variant: 'success',
      title: `${name} deleted`,
      description: 'The workspace is ready for a new design.',
    });
  };

  return (
    <Dialog open={open && rack !== null} onClose={() => setOpen(false)} width={400}>
      <div className="p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-danger/12">
          <Trash2 className="size-4.5 text-danger" strokeWidth={1.75} />
        </div>
        <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight">
          Delete “{rack?.name}”?
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-secondary">
          The {rack?.units}U rack and its configuration will be removed from
          the workspace. This can't be undone yet — undo history arrives in a
          later milestone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setOpen(false)}
            className="h-8 rounded-[9px] border border-edge px-3.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={confirm}
            className="h-8 rounded-[9px] bg-danger px-3.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-danger/85"
          >
            Delete Rack
          </motion.button>
        </div>
      </div>
    </Dialog>
  );
}
