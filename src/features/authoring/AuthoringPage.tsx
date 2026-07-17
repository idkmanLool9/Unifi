import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CircleCheck, OctagonX } from 'lucide-react';
import { AuthoringTopBar } from './AuthoringTopBar';
import { AuthoringViewport } from './AuthoringViewport';
import { PortInspectorPanel } from './PortInspectorPanel';
import { PortLayoutStrip } from './PortLayoutStrip';
import { PortToolsPanel } from './PortToolsPanel';
import { useAuthoringStore } from './authoringStore';
import { useAuthoringShortcuts } from './useAuthoringShortcuts';
import { useValidation } from './useValidation';
import { ContextMenuHost } from '@/components/ui/ContextMenuHost';
import { ToastHost } from '@/components/ui/ToastHost';
import {
  allDevices,
  getDevice,
  useRegistryStore,
} from '@/features/devices/deviceRegistry';
import { useCalibrationStore } from '@/features/devices/hardware/connectorCalibration';

/**
 * Device Authoring Mode — a dedicated professional editor for preparing
 * imported GLB models: every interactive hardware element is placed by
 * hand once, saved as metadata, and every RackForge feature (cables,
 * Etherlighting, hover, anchors, compatibility) works from then on
 * without guessing. The GLB itself is never modified.
 */
export function AuthoringPage() {
  const [params] = useSearchParams();
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const dirty = useAuthoringStore((s) => s.dirty);
  const calibrationVersion = useCalibrationStore((s) => s.version);

  useAuthoringShortcuts();

  // Open the requested device (or the first registered one) on entry.
  useEffect(() => {
    const requested = params.get('device');
    const id =
      requested && getDevice(requested) ? requested : allDevices()[0]?.id;
    if (id) useAuthoringStore.getState().open(id);
    return () => useAuthoringStore.getState().close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GLB analysis lands asynchronously (model load → detection). Reload
  // the port set once, so calibration-refined positions are what the
  // developer starts editing — but never clobber unsaved edits.
  useEffect(() => {
    if (calibrationVersion === 0) return;
    const state = useAuthoringStore.getState();
    if (!state.dirty && state.deviceId) state.reload();
    else state.refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationVersion]);

  // Definitions also land asynchronously at startup (external metadata,
  // then browser-persisted authored devices). Re-derive the session so
  // the editor always shows the definition that actually won — and if
  // the URL requested a device that only just finished loading (an
  // external-only definition), switch to it. Never over unsaved edits.
  const registryVersion = useRegistryStore((s) => s.version);
  useEffect(() => {
    const state = useAuthoringStore.getState();
    if (!state.deviceId || state.dirty) return;
    const requested = params.get('device');
    if (requested && requested !== state.deviceId && getDevice(requested)) {
      state.open(requested);
    } else {
      state.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryVersion]);

  // Guard against losing unsaved authoring work on tab close.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-primary">
      <AuthoringTopBar />
      <div className="flex min-h-0 flex-1">
        <PortToolsPanel />
        <AuthoringViewport />
        <PortInspectorPanel />
      </div>
      <PortLayoutStrip />
      <AuthoringStatusBar deviceId={deviceId} />

      <ContextMenuHost />
      <ToastHost />
    </div>
  );
}

function AuthoringStatusBar({ deviceId }: { deviceId: string | null }) {
  const ports = useAuthoringStore((s) => s.ports);
  const dirty = useAuthoringStore((s) => s.dirty);
  const setCategory = useAuthoringStore((s) => s.setCategory);
  const { counts: validation } = useValidation();
  const definition = deviceId ? getDevice(deviceId) : undefined;

  const counts = new Map<string, number>();
  for (const p of ports) {
    counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count}× ${type.toUpperCase()}`)
    .join(', ');

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-edge bg-surface px-3 text-[11px]">
      <span className="flex items-center gap-1.5">
        <span
          className={
            dirty
              ? 'size-1.5 rounded-full bg-warning'
              : 'size-1.5 rounded-full bg-success'
          }
        />
        <span className="text-secondary">
          {dirty ? 'Unsaved changes' : 'Ready'}
        </span>
      </span>
      <span className="text-muted">
        Mode <span className="font-medium text-secondary">Port Authoring</span>
      </span>
      <span className="text-muted">
        Device{' '}
        <span className="font-medium text-secondary">
          {definition?.productName ?? '—'}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setCategory('validation')}
        className="ml-auto flex items-center gap-2 rounded px-1.5 py-0.5 transition-colors hover:bg-raised"
        title="Open the Validation category"
      >
        {validation.errors > 0 && (
          <span className="flex items-center gap-1 text-danger">
            <OctagonX className="size-3" /> {validation.errors}
          </span>
        )}
        {validation.warnings > 0 && (
          <span className="flex items-center gap-1 text-warning">
            <AlertTriangle className="size-3" /> {validation.warnings}
          </span>
        )}
        {validation.errors === 0 && validation.warnings === 0 && (
          <span className="flex items-center gap-1 text-success">
            <CircleCheck className="size-3" /> Valid
          </span>
        )}
      </button>
      <span className="text-muted">
        Ports{' '}
        <span className="font-medium text-secondary">
          {ports.length}
          {breakdown ? ` (${breakdown})` : ''}
        </span>
      </span>
    </footer>
  );
}
