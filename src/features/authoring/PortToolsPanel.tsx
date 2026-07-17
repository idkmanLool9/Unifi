import {
  Cable,
  Copy,
  FlipHorizontal2,
  Grid2x2,
  LayoutGrid,
  MousePointer2,
  Move,
  Plug,
  PlugZap,
  Rotate3d,
  Scaling,
  Sparkles,
  SquareTerminal,
  Trash2,
  Usb,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useAuthoringStore, type AuthoringTool } from './authoringStore';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Kbd } from '@/components/ui/Kbd';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { Switch } from '@/components/ui/Switch';
import type { PortType } from '@/features/devices/deviceSchema';
import { cn } from '@/lib/utils';

/** The Add Port palette, mirroring the reference layout. */
const PORT_TOOLS: ReadonlyArray<{
  type: PortType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: 'rj45', label: 'RJ45', icon: Cable },
  { type: 'sfp', label: 'SFP', icon: Plug },
  { type: 'sfp+', label: 'SFP+', icon: Plug },
  { type: 'qsfp+', label: 'QSFP+', icon: PlugZap },
  { type: 'usb-a', label: 'USB-A', icon: Usb },
  { type: 'usb-c', label: 'USB-C', icon: Usb },
  { type: 'console', label: 'Console', icon: SquareTerminal },
  { type: 'serial', label: 'Serial', icon: SquareTerminal },
  { type: 'c14', label: 'Power (IEC C14)', icon: Zap },
  { type: 'c20', label: 'Power (IEC C20)', icon: Zap },
  { type: 'dc', label: 'DC Input', icon: Zap },
  { type: 'other', label: 'Custom', icon: Grid2x2 },
];

function ActionRow({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] transition-colors duration-100',
        active
          ? 'bg-accent/12 text-accent'
          : danger
            ? 'text-secondary hover:bg-danger/10 hover:text-danger'
            : 'text-secondary hover:bg-surface-hover hover:text-primary',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}

/** Left sidebar of the authoring mode: add-port palette, actions, snap. */
export function PortToolsPanel() {
  const addPort = useAuthoringStore((s) => s.addPort);
  const tool = useAuthoringStore((s) => s.tool);
  const setTool = useAuthoringStore((s) => s.setTool);
  const selection = useAuthoringStore((s) => s.selection);
  const duplicateSelection = useAuthoringStore((s) => s.duplicateSelection);
  const mirrorSelection = useAuthoringStore((s) => s.mirrorSelection);
  const deleteSelection = useAuthoringStore((s) => s.deleteSelection);
  const snap = useAuthoringStore((s) => s.snap);
  const setSnap = useAuthoringStore((s) => s.setSnap);
  const suggestions = useAuthoringStore((s) => s.suggestions);
  const applySuggestions = useAuthoringStore((s) => s.applySuggestions);
  const rejectSuggestions = useAuthoringStore((s) => s.rejectSuggestions);
  const detectPorts = useAuthoringStore((s) => s.detectPorts);

  const hasSelection = selection.length > 0;
  const toolRow = (id: AuthoringTool, icon: LucideIcon, label: string, key: string) => (
    <ActionRow
      icon={icon}
      label={label}
      shortcut={key}
      active={tool === id}
      onClick={() => setTool(id)}
    />
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-edge bg-surface">
      <PanelHeader title="Port Tools" />

      <CollapsibleSection title="ADD PORT">
        <div className="grid grid-cols-1 gap-0.5">
          {PORT_TOOLS.map(({ type, label, icon: Icon }) => (
            <button
              key={`${type}-${label}`}
              type="button"
              onClick={() => addPort(type)}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-[12px] text-secondary transition-colors duration-100 hover:bg-accent/12 hover:text-accent"
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="ACTIONS">
        <div className="space-y-0.5">
          {toolRow('select', MousePointer2, 'Select', 'Q')}
          {toolRow('move', Move, 'Move', 'W')}
          {toolRow('rotate', Rotate3d, 'Rotate', 'E')}
          {toolRow('scale', Scaling, 'Scale', 'R')}
          <ActionRow
            icon={Copy}
            label="Duplicate"
            shortcut="⌘D"
            disabled={!hasSelection}
            onClick={duplicateSelection}
          />
          <ActionRow
            icon={LayoutGrid}
            label="Array…"
            disabled={!hasSelection}
            onClick={() =>
              document.getElementById('authoring-array-count')?.focus()
            }
          />
          <ActionRow
            icon={FlipHorizontal2}
            label="Mirror"
            disabled={!hasSelection}
            onClick={mirrorSelection}
          />
          <ActionRow
            icon={Trash2}
            label="Delete"
            shortcut="⌫"
            danger
            disabled={!hasSelection}
            onClick={deleteSelection}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="SNAPPING">
        <div className="space-y-2">
          {(
            [
              ['Enable snapping', 'enabled'],
              ['Snap to port centers', 'centers'],
              ['Snap to edges', 'edges'],
              ['Snap to grid', 'grid'],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="flex items-center justify-between">
              <span
                className={cn(
                  'text-xs',
                  key !== 'enabled' && !snap.enabled
                    ? 'text-muted'
                    : 'text-secondary',
                )}
              >
                {label}
              </span>
              <Switch
                checked={snap[key]}
                disabled={key !== 'enabled' && !snap.enabled}
                onChange={(checked) => setSnap({ [key]: checked })}
                label={label}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="GLB ANALYSIS">
        <div className="space-y-2">
          {suggestions ? (
            <>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-secondary">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={1.8} />
                Detected {suggestions.length} connector candidate
                {suggestions.length === 1 ? '' : 's'} in the model geometry
                (shown in green). Accept to replace the current ports, or
                reject to discard the analysis completely.
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={applySuggestions}
                  className="h-6 flex-1 rounded-md bg-accent text-[11px] font-semibold text-white transition-colors hover:bg-accent/90"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={rejectSuggestions}
                  className="h-6 flex-1 rounded-md border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover"
                >
                  Reject
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={detectPorts}
              className="flex h-6 w-full items-center justify-center gap-1.5 rounded-md border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            >
              <Sparkles className="size-3.5" strokeWidth={1.8} />
              Detect connectors
            </button>
          )}
        </div>
      </CollapsibleSection>
    </aside>
  );
}
