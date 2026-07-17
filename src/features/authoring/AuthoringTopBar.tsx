import {
  ChevronDown,
  Grid3x3,
  Magnet,
  MousePointer2,
  Move,
  Rotate3d,
  Ruler,
  Save,
  Scaling,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthoringStore, type AuthoringTool } from './authoringStore';
import { LogoMark } from '@/components/ui/LogoMark';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tooltip } from '@/components/ui/Tooltip';
import { allDevices, getDevice } from '@/features/devices/deviceRegistry';
import { useMenuStore } from '@/stores/menuStore';
import { toast } from '@/stores/toastStore';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

const TOOLS: ReadonlyArray<{
  id: AuthoringTool;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}> = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'Q' },
  { id: 'move', icon: Move, label: 'Move', shortcut: 'W' },
  { id: 'rotate', icon: Rotate3d, label: 'Rotate', shortcut: 'E' },
  { id: 'scale', icon: Scaling, label: 'Scale', shortcut: 'R' },
];

function ToolbarButton({
  label,
  shortcut,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          'flex size-7 items-center justify-center rounded-lg transition-colors duration-100',
          active
            ? 'bg-accent/15 text-accent'
            : 'text-muted hover:bg-surface-hover hover:text-secondary',
        )}
      >
        <Icon className="size-4" strokeWidth={1.8} />
      </button>
    </Tooltip>
  );
}

/** Top chrome of the Device Authoring mode, following the app toolbar. */
export function AuthoringTopBar() {
  const navigate = useNavigate();
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const mode = useAuthoringStore((s) => s.mode);
  const setMode = useAuthoringStore((s) => s.setMode);
  const tool = useAuthoringStore((s) => s.tool);
  const setTool = useAuthoringStore((s) => s.setTool);
  const snapEnabled = useAuthoringStore((s) => s.snap.enabled);
  const setSnap = useAuthoringStore((s) => s.setSnap);
  const gridVisible = useAuthoringStore((s) => s.gridVisible);
  const toggleGrid = useAuthoringStore((s) => s.toggleGrid);
  const dirty = useAuthoringStore((s) => s.dirty);
  const open = useAuthoringStore((s) => s.open);
  const save = useAuthoringStore((s) => s.save);

  const definition = deviceId ? getDevice(deviceId) : undefined;

  const openDevicePicker = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    useMenuStore.getState().openMenu(
      rect.left,
      rect.bottom + 4,
      allDevices().map((d) => ({
        id: d.id,
        label: `${d.manufacturerName} ${d.productName}`,
        action: () => open(d.id),
      })),
    );
  };

  const onSave = () => {
    if (!definition) return;
    if (save()) {
      downloadMetadata();
      toast({
        variant: 'success',
        title: 'Ports saved',
        description:
          'Definition updated for this session — metadata.json downloaded. Drop it into public/devices/… to make it permanent.',
      });
    }
  };

  const downloadMetadata = () => {
    const state = useAuthoringStore.getState();
    const base = state.deviceId ? getDevice(state.deviceId) : undefined;
    if (!base) return;
    // The registry now holds the authored definition (save() ran first).
    const json = JSON.stringify(base, null, 2) + '\n';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metadata.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-edge bg-surface px-3">
      <div className="flex items-center gap-2">
        <LogoMark className="size-6" />
        <span className="text-[13px] font-semibold text-primary">
          {APP_NAME}
        </span>
        <span className="rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 text-[11px] font-medium text-accent">
          Port Authoring Mode
        </span>
      </div>

      <button
        type="button"
        onClick={openDevicePicker}
        className="flex h-7 items-center gap-1.5 rounded-lg border border-edge bg-background/40 px-2.5 text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <span className="text-muted">Device:</span>
        <span className="font-medium text-primary">
          {definition?.productName ?? '—'}
        </span>
        <ChevronDown className="size-3.5 text-muted" strokeWidth={2} />
      </button>

      <div className="mx-auto flex items-center gap-2">
        <div className="w-44">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            label="Authoring mode"
            options={[
              { value: 'view', label: 'View' },
              { value: 'edit', label: 'Edit Ports' },
            ]}
          />
        </div>
        <div className="mx-1 h-4 w-px bg-edge-strong/60" />
        <div className="flex items-center gap-0.5 rounded-[10px] border border-edge bg-background/40 p-[3px]">
          {TOOLS.map(({ id, icon, label, shortcut }) => (
            <ToolbarButton
              key={id}
              icon={icon}
              label={label}
              shortcut={shortcut}
              active={tool === id}
              onClick={() => setTool(id)}
            />
          ))}
        </div>
        <div className="mx-1 h-4 w-px bg-edge-strong/60" />
        <ToolbarButton
          icon={Grid3x3}
          label={gridVisible ? 'Hide floor grid' : 'Show floor grid'}
          active={gridVisible}
          onClick={toggleGrid}
        />
        <ToolbarButton
          icon={Magnet}
          label={snapEnabled ? 'Disable snapping' : 'Enable snapping'}
          active={snapEnabled}
          onClick={() => setSnap({ enabled: !snapEnabled })}
        />
        <ToolbarButton
          icon={Ruler}
          label="Frame ports"
          shortcut="F"
          onClick={() =>
            useAuthoringStore
              .getState()
              .dispatchCamera({ type: 'frame-ports', face: 'front' })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-edge bg-background/40 px-2.5 text-[12px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
        >
          <Undo2 className="size-3.5" strokeWidth={1.8} />
          Preview in Rack
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors',
            'bg-accent text-white hover:bg-accent/90',
            !dirty && 'opacity-60',
          )}
        >
          <Save className="size-3.5" strokeWidth={2} />
          Save Ports
        </button>
      </div>
    </header>
  );
}
