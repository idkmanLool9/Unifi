import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { confirmProjectImport, useProjectImportStore } from './projectActions';
import { summarizeProject } from './projectFile';

/**
 * Confirmation before a project file replaces the current workspace.
 * Shows what the file contains so loading the wrong export is caught
 * before anything is overwritten.
 */
export function ProjectImportDialog() {
  const pending = useProjectImportStore((s) => s.pending);
  const setPending = useProjectImportStore((s) => s.setPending);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(
    () => (pending ? summarizeProject(pending.project) : null),
    [pending],
  );

  const load = () => {
    setBusy(true);
    void confirmProjectImport().finally(() => setBusy(false));
  };

  return (
    <Dialog
      open={pending !== null}
      onClose={() => !busy && setPending(null)}
      width={420}
    >
      <div className="p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12">
          <FolderOpen className="size-4.5 text-accent" strokeWidth={1.75} />
        </div>
        <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight">
          Load “{summary?.rackName ?? pending?.fileName}”?
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-secondary">
          {summary && (
            <>
              {summary.deviceCount} device
              {summary.deviceCount === 1 ? '' : 's'}, {summary.cableCount}{' '}
              cable{summary.cableCount === 1 ? '' : 's'},{' '}
              {summary.authoredCount} authored definition
              {summary.authoredCount === 1 ? '' : 's'}
              {summary.modelCount > 0 &&
                ` and ${summary.modelCount} imported model${
                  summary.modelCount === 1 ? '' : 's'
                }`}
              .{' '}
            </>
          )}
          Loading replaces everything currently in this workspace — export
          the current project first if you want to keep it.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            disabled={busy}
            onClick={() => setPending(null)}
            className="h-8 rounded-[9px] border border-edge px-3.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            disabled={busy}
            onClick={load}
            className="h-8 rounded-[9px] bg-accent px-3.5 text-xs font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Loading…' : 'Load Project'}
          </motion.button>
        </div>
      </div>
    </Dialog>
  );
}
