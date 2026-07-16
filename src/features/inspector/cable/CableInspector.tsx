import { Trash2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { InfoRow } from '../InfoRow';
import {
  CABLE_CATALOG,
  CABLE_PALETTE,
  cableTypesBetween,
  type CableTypeId,
} from '@/features/cables/cableCatalog';
import { formatLength } from '@/features/cables/compatibility';
import { recommendLengthMm, ROUTING_MODES, type RoutingMode, type SlackMode } from '@/features/cables/routing';
import { resolveEndPort } from '@/stores/cableToolStore';
import { useCableStore, type CableInstance } from '@/stores/cableStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { toast } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const SLACK_OPTIONS: ReadonlyArray<{ value: SlackMode; label: string }> = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'service-loop', label: 'Loop' },
];

const MODE_LABELS: Record<RoutingMode, string> = {
  auto: 'Auto',
  direct: 'Direct',
  natural: 'Natural',
  left: 'Left side',
  right: 'Right side',
  top: 'Top',
  bottom: 'Bottom',
  'cable-manager': 'Cable manager',
  manual: 'Manual',
};
/** Manual waypoint editing arrives later — hide it from the picker. */
const MODE_CHOICES = ROUTING_MODES.filter((m) => m !== 'manual');

const STATUS_STYLE: Record<CableInstance['status'], string> = {
  ok: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  invalid: 'bg-danger/15 text-danger',
};

/** Inspector contents for a selected cable — every control is live. */
export function CableInspector({ cable }: { cable: CableInstance }) {
  const updateCable = useCableStore((s) => s.updateCable);
  const removeCable = useCableStore((s) => s.removeCable);
  const clearSelection = useSelectionStore((s) => s.clear);

  const spec = CABLE_CATALOG[cable.type];
  const src = resolveEndPort(cable.source);
  const dst = resolveEndPort(cable.destination);

  const endName = (end: typeof src, ref: string): string => {
    if (!end) return ref;
    return `${end.definition.productName} · ${ref}`;
  };

  const compatibleTypes: CableTypeId[] =
    src && dst
      ? cableTypesBetween(src.port.type, dst.port.type).map((s) => s.id)
      : [cable.type];

  const slack = cable.nominalLengthMm - Math.min(cable.calculatedRouteLengthMm, cable.nominalLengthMm);
  const minRoute = cable.calculatedRouteLengthMm;
  const recommended = recommendLengthMm(minRoute, spec.standardLengthsMm);

  const remove = () => {
    removeCable(cable.id);
    clearSelection();
    toast({ variant: 'success', title: 'Cable removed' });
  };

  return (
    <>
      <CollapsibleSection title="Connection">
        <InfoRow label="From">{endName(src, cable.source.portRef)}</InfoRow>
        <InfoRow label="To">{endName(dst, cable.destination.portRef)}</InfoRow>
        <InfoRow label="Status">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
              STATUS_STYLE[cable.status],
            )}
          >
            {cable.status === 'ok'
              ? 'OK'
              : cable.status === 'warning'
                ? 'Warning'
                : 'Invalid'}
          </span>
        </InfoRow>
        {cable.statusMessage && (
          <p
            className={cn(
              'pt-1 text-[10.5px] leading-snug',
              cable.status === 'invalid' ? 'text-danger' : 'text-warning',
            )}
          >
            {cable.statusMessage}
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Cable">
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor="cable-type" className="block text-xs text-secondary">
              Type
            </label>
            <select
              id="cable-type"
              value={cable.type}
              onChange={(e) => {
                const next = CABLE_CATALOG[e.target.value as CableTypeId];
                updateCable(cable.id, {
                  type: next.id,
                  color: next.defaultColor,
                  thicknessMm: next.diameterMm,
                  bendRadiusMm: next.minBendRadiusMm,
                });
              }}
              className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
            >
              {compatibleTypes.map((id) => (
                <option key={id} value={id}>
                  {CABLE_CATALOG[id].name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="cable-length" className="block text-xs text-secondary">
              Length
            </label>
            <select
              id="cable-length"
              value={
                spec.standardLengthsMm.includes(cable.nominalLengthMm)
                  ? String(cable.nominalLengthMm)
                  : 'custom'
              }
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                updateCable(cable.id, { nominalLengthMm: Number(e.target.value) });
              }}
              className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
            >
              {spec.standardLengthsMm.map((mm) => (
                <option key={mm} value={mm}>
                  {formatLength(mm)}
                  {mm === recommended ? ' · recommended' : ''}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            <input
              type="number"
              aria-label="Custom length (mm)"
              min={100}
              step={50}
              value={cable.nominalLengthMm}
              onChange={(e) =>
                updateCable(cable.id, {
                  nominalLengthMm: Math.max(100, Number(e.target.value) || 100),
                })
              }
              className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary tabular-nums focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <span className="block text-xs text-secondary">Color</span>
            <div className="flex flex-wrap gap-1">
              {CABLE_PALETTE.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  title={swatch.name}
                  aria-label={`Cable color ${swatch.name}`}
                  aria-pressed={cable.color === swatch.hex}
                  onClick={() => updateCable(cable.id, { color: swatch.hex })}
                  className={cn(
                    'size-5 rounded-md border transition-transform hover:scale-110',
                    cable.color === swatch.hex
                      ? 'border-accent ring-1 ring-accent'
                      : 'border-edge',
                  )}
                  style={{ backgroundColor: swatch.hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Routing">
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor="cable-route" className="block text-xs text-secondary">
              Routing mode
            </label>
            <select
              id="cable-route"
              value={cable.routingMode}
              onChange={(e) =>
                updateCable(cable.id, {
                  routingMode: e.target.value as RoutingMode,
                })
              }
              className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none"
            >
              {MODE_CHOICES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs text-secondary">Slack</span>
            <SegmentedControl
              label="Slack mode"
              value={
                cable.slackMode === 'custom' ? 'normal' : cable.slackMode
              }
              onChange={(slackMode) => updateCable(cable.id, { slackMode })}
              options={SLACK_OPTIONS}
            />
          </div>

          <InfoRow label="Calculated route">
            {minRoute > 0 ? formatLength(minRoute) : '—'}
          </InfoRow>
          <InfoRow label="Recommended">
            {minRoute > 0 ? formatLength(recommended) : '—'}
          </InfoRow>
          <InfoRow label="Chosen length">
            {formatLength(cable.nominalLengthMm)}
          </InfoRow>
          <InfoRow label="Remaining slack">
            {minRoute > 0 ? formatLength(Math.max(slack, 0)) : '—'}
          </InfoRow>
          <InfoRow label="Min bend radius">{cable.bendRadiusMm} mm</InfoRow>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Label">
        <div className="space-y-2">
          <input
            type="text"
            aria-label="Cable label"
            placeholder="Label (e.g. LAN uplink)"
            value={cable.label ?? ''}
            onChange={(e) =>
              updateCable(cable.id, { label: e.target.value || undefined })
            }
            className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary focus:border-accent focus:outline-none"
          />
          <textarea
            aria-label="Cable notes"
            placeholder="Notes"
            rows={2}
            value={cable.notes ?? ''}
            onChange={(e) =>
              updateCable(cable.id, { notes: e.target.value || undefined })
            }
            className="w-full rounded-lg border border-edge bg-surface-raised px-2 py-1.5 text-xs text-primary focus:border-accent focus:outline-none"
          />
        </div>
      </CollapsibleSection>

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={remove}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          Remove cable
        </button>
      </div>
    </>
  );
}
