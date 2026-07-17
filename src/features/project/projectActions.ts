import { create } from 'zustand';
import {
  applyProjectFile,
  buildProjectFile,
  parseProjectFile,
  projectFileName,
  type ProjectFile,
} from './projectFile';
import { useRackStore } from '@/stores/rackStore';
import { toast } from '@/stores/toastStore';

/**
 * Browser glue for whole-project save/load: download the export,
 * pick + parse an import, and hold the parsed file while the user
 * confirms replacing the current workspace.
 */

interface ProjectImportState {
  pending: { project: ProjectFile; fileName: string } | null;
  setPending: (
    pending: { project: ProjectFile; fileName: string } | null,
  ) => void;
}

export const useProjectImportStore = create<ProjectImportState>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));

/** Downloads the whole project as one restorable file. */
export async function exportProject(): Promise<void> {
  try {
    const project = await buildProjectFile();
    const name = useRackStore.getState().rack?.name ?? 'rackforge-project';
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.download = projectFileName(name);
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    toast({
      variant: 'success',
      title: 'Project exported',
      description:
        'One file with your rack, cables, authored devices and imported models. Restore it anywhere via Open project.',
    });
  } catch (error) {
    toast({
      variant: 'error',
      title: 'Export failed',
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Opens the file picker and stages a parsed project for confirmation. */
export function requestProjectImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const parsed = parseProjectFile(text);
      if (!parsed.ok) {
        toast({
          variant: 'error',
          title: 'Could not open project',
          description: parsed.message,
        });
        return;
      }
      useProjectImportStore
        .getState()
        .setPending({ project: parsed.value, fileName: file.name });
    });
  };
  input.click();
}

/**
 * Applies the staged project and reboots the app from the imported
 * state — the same path as a fresh session, so authored definitions,
 * definition patches and imported models all rehydrate in order.
 */
export async function confirmProjectImport(): Promise<void> {
  const pending = useProjectImportStore.getState().pending;
  if (!pending) return;
  try {
    await applyProjectFile(pending.project);
    window.location.reload();
  } catch (error) {
    useProjectImportStore.getState().setPending(null);
    toast({
      variant: 'error',
      title: 'Import failed',
      description: error instanceof Error ? error.message : String(error),
    });
  }
}
