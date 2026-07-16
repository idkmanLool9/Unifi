import { create } from 'zustand';
import type { ImportReport } from './modelImport';

/**
 * Registry of import reports — the last pipeline stage. One report per
 * definition id, produced when a device's GLB is measured. Dimension
 * warnings surface once in the console; the debug overlay reads the
 * full report. Session-scoped, never persisted.
 */

interface ImportReportState {
  reports: Record<string, ImportReport>;
  register: (report: ImportReport) => void;
}

const warned = new Set<string>();

export const useImportReportStore = create<ImportReportState>()((set) => ({
  reports: {},

  register: (report) => {
    set((s) => ({ reports: { ...s.reports, [report.definitionId]: report } }));
    if (report.warnings.length > 0 && !warned.has(report.definitionId)) {
      warned.add(report.definitionId);
      console.warn(
        `[import] ${report.definitionId}: model deviates from the ` +
          `manufacturer spec (never auto-scaled):\n  ` +
          report.warnings.join('\n  '),
      );
    }
  },
}));

export const getImportReport = (definitionId: string): ImportReport | undefined =>
  useImportReportStore.getState().reports[definitionId];
