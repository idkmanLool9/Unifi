import { useState } from 'react';
import {
  ArrowLeftRight,
  BookmarkPlus,
  Boxes,
  RotateCcw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { InfoRow } from '../InfoRow';
import {
  CABLE_CATALOG,
  CABLE_PALETTE,
  cableTypesBetween,
  type CableTypeId,
  type FiberConnector,
} from '@/features/cables/cableCatalog';
import { formatLength } from '@/features/cables/compatibility';
import {
  recommendLengthMm,
  ROUTING_MODES,
  type RoutingMode,
  type SlackMode,
} from '@/features/cables/routing';
import { getDevice } from '@/features/devices/deviceRegistry';
import { resolveEndPort } from '@/stores/cableToolStore';
import { useCablePresetsStore } from '@/stores/cablePresetsStore';
import {
  useBundleHighlightStore,
  useCableStore,
  type CableInstance,
} from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { toast } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const SLACK_OPTIONS: ReadonlyArray<{ value: SlackMode; label: string }> = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'service-loop', label: 'Loop' },
];

const MODE_LABELS: Record<RoutingMode, string> = {
  auto: 'Auto (hybrid)',
  direct: 'Shortest',
  natural: 'Cleanest',
  professional: 'Professional',
  managed: 'Managed (via hardware)',
  left: 'Left side',
  right: 'Right side',
  top: 'Top',
  bottom: 'Bottom',
  'cable-manager': 'Manager priority',
  manual: 'Manual',
};

const FIBER_LABELS: Record<FiberConnector, string> = {
  'lc-lc': 'LC ↔ LC',
  'lc-sc': 'LC ↔ SC',
  mpo: 'MPO trunk',
};

const STATUS_STYLE: Record<CableInstance['status'], string> = {
  ok: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  invalid: 'bg-danger/15 text-danger',
};

const inputClass =
  'h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium text-primary focus:border-accent focus:outline-none';
const selectClass =
  'h-7 w-full rounded-lg border border-edge bg-surface-raised px-1.5 text-xs font-medium text-primary focus:border-accent focus:outline-none';

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

  const slack =
    cable.nominalLengthMm -
    Math.min(cable.calculatedRouteLengthMm, cable.nominalLengthMm);
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
                  fiberConnector: next.fiberConnectors ? 'lc-lc' : undefined,
                });
              }}
              className={selectClass}
            >
              {compatibleTypes.map((id) => (
                <option key={id} value={id}>
                  {CABLE_CATALOG[id].name}
                </option>
              ))}
            </select>
          </div>

          {spec.fiberConnectors && (
            <div className="space-y-1">
              <label
                htmlFor="cable-fiber"
                className="block text-xs text-secondary"
              >
                Termination
              </label>
              <select
                id="cable-fiber"
                value={cable.fiberConnector ?? 'lc-lc'}
                onChange={(e) =>
                  updateCable(cable.id, {
                    fiberConnector: e.target.value as FiberConnector,
                  })
                }
                className={selectClass}
              >
                {spec.fiberConnectors.map((fc) => (
                  <option key={fc} value={fc}>
                    {FIBER_LABELS[fc]}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className={selectClass}
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
              className={cn(inputClass, 'tabular-nums')}
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
              className={selectClass}
            >
              {ROUTING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            {cable.routingMode === 'manual' && (
              <p className="text-[10.5px] leading-snug text-muted">
                Drag the control points in the viewport. Click a ghost dot to
                insert one, double-click a point to delete it.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs text-secondary">Slack</span>
            <SegmentedControl
              label="Slack mode"
              value={cable.slackMode === 'custom' ? 'normal' : cable.slackMode}
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

          <ManagementTools cable={cable} />

          <button
            type="button"
            onClick={() =>
              updateCable(cable.id, {
                routingMode: 'auto',
                waypointsMm: undefined,
                viaInstanceId: undefined,
                ignoreManagers: undefined,
              })
            }
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
          >
            <RotateCcw className="size-3" strokeWidth={1.75} />
            Reset routing
          </button>
        </div>
      </CollapsibleSection>

      <BundleSection cable={cable} />

      <CollapsibleSection title="Label & documentation">
        <div className="space-y-2">
          <input
            type="text"
            aria-label="Cable label"
            placeholder="Label (e.g. LAN uplink)"
            value={cable.label ?? ''}
            onChange={(e) =>
              updateCable(cable.id, { label: e.target.value || undefined })
            }
            className={inputClass}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary">Show label at both ends</span>
            <Switch
              label="Show label in viewport"
              checked={cable.labelVisible ?? false}
              onChange={(labelVisible) => updateCable(cable.id, { labelVisible })}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              aria-label="Manufacturer"
              placeholder="Manufacturer"
              value={cable.manufacturer ?? ''}
              onChange={(e) =>
                updateCable(cable.id, {
                  manufacturer: e.target.value || undefined,
                })
              }
              className={inputClass}
            />
            <input
              type="text"
              aria-label="Part number"
              placeholder="Part no."
              value={cable.partNumber ?? ''}
              onChange={(e) =>
                updateCable(cable.id, { partNumber: e.target.value || undefined })
              }
              className={inputClass}
            />
          </div>
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
          <div className="space-y-1">
            <span className="block text-xs text-secondary">Instructions</span>
            <textarea
              aria-label="Cable instructions"
              placeholder="Installation / patching instructions…"
              rows={4}
              value={cable.instructions ?? ''}
              onChange={(e) =>
                updateCable(cable.id, {
                  instructions: e.target.value || undefined,
                })
              }
              className="w-full rounded-lg border border-edge bg-surface-raised px-2 py-1.5 text-xs leading-relaxed text-primary focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </CollapsibleSection>

      <PresetSection cable={cable} />

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

/* ---- cable management tools ------------------------------------------- */

/** Management assets currently mounted in the rack. */
function useMountedManagers() {
  const instances = useDeviceInstancesStore((s) => s.instances);
  return instances
    .map((instance) => ({
      instance,
      definition: getDevice(instance.definitionId),
    }))
    .filter(
      (
        entry,
      ): entry is {
        instance: (typeof instances)[number];
        definition: NonNullable<ReturnType<typeof getDevice>>;
      } => entry.definition?.cableManagement !== undefined,
    );
}

function ManagementTools({ cable }: { cable: CableInstance }) {
  const updateCable = useCableStore((s) => s.updateCable);
  const reverseCable = useCableStore((s) => s.reverseCable);
  const managers = useMountedManagers();

  return (
    <div className="space-y-2">
      {managers.length > 0 && (
        <div className="space-y-1">
          <label
            htmlFor="cable-via"
            className="block text-xs text-secondary"
          >
            Force through manager
          </label>
          <select
            id="cable-via"
            value={cable.viaInstanceId ?? ''}
            onChange={(e) =>
              updateCable(cable.id, {
                viaInstanceId: e.target.value || undefined,
                ignoreManagers: e.target.value ? undefined : cable.ignoreManagers,
              })
            }
            className={selectClass}
          >
            <option value="">Automatic (cheapest path)</option>
            {managers.map(({ instance, definition }) => (
              <option key={instance.id} value={instance.id}>
                {definition.productName} · U{instance.startU}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary">Ignore cable managers</span>
        <Switch
          label="Ignore cable managers"
          checked={cable.ignoreManagers ?? false}
          onChange={(ignore) =>
            updateCable(cable.id, {
              ignoreManagers: ignore || undefined,
              viaInstanceId: ignore ? undefined : cable.viaInstanceId,
            })
          }
        />
      </div>
      {(cable.routedNodeKeys?.length ?? 0) > 0 && (
        <InfoRow label="Routed via">
          {cable.routedNodeKeys!.length} node
          {cable.routedNodeKeys!.length === 1 ? '' : 's'}
        </InfoRow>
      )}
      <button
        type="button"
        onClick={() => reverseCable(cable.id)}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
      >
        <ArrowLeftRight className="size-3" strokeWidth={1.75} />
        Reverse direction
      </button>
    </div>
  );
}

/* ---- bundles ---------------------------------------------------------- */

function BundleSection({ cable }: { cable: CableInstance }) {
  const bundles = useCableStore((s) => s.bundles);
  const cables = useCableStore((s) => s.cables);
  const createBundle = useCableStore((s) => s.createBundle);
  const updateBundle = useCableStore((s) => s.updateBundle);
  const removeBundle = useCableStore((s) => s.removeBundle);
  const assignToBundle = useCableStore((s) => s.assignToBundle);
  const mergeBundles = useCableStore((s) => s.mergeBundles);
  const splitBundle = useCableStore((s) => s.splitBundle);
  const highlighted = useBundleHighlightStore(
    (s) => s.highlightBundleId === (cable.bundleId ?? null) && s.highlightBundleId !== null,
  );
  const setHighlight = useBundleHighlightStore((s) => s.setHighlight);

  const bundle = cable.bundleId
    ? bundles.find((b) => b.id === cable.bundleId)
    : undefined;
  const members = bundle
    ? cables.filter((c) => c.bundleId === bundle.id)
    : [];
  const memberCount = members.length;
  // Estimated loom diameter from hex packing: rings of 6·r around one.
  const maxDiameter = Math.max(...members.map((m) => m.thicknessMm), 0);
  const rings = memberCount <= 1 ? 0 : memberCount <= 7 ? 1 : memberCount <= 19 ? 2 : 3;
  const loomDiameterMm = Math.round(
    maxDiameter * (1 + 2 * rings) + (bundle?.spacingMm ?? 0) * 2 * rings,
  );

  return (
    <CollapsibleSection title="Bundle">
      <div className="space-y-2">
        <div className="space-y-1">
          <label htmlFor="cable-bundle" className="block text-xs text-secondary">
            Bundle membership
          </label>
          <select
            id="cable-bundle"
            value={cable.bundleId ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                const created = createBundle();
                assignToBundle(cable.id, created.id);
                toast({ variant: 'success', title: `${created.name} created` });
              } else {
                assignToBundle(cable.id, e.target.value || undefined);
              }
            }}
            className={selectClass}
          >
            <option value="">Not bundled</option>
            {bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value="__new__">＋ New bundle…</option>
          </select>
        </div>

        {bundle && (
          <>
            <input
              type="text"
              aria-label="Bundle name"
              value={bundle.name}
              onChange={(e) =>
                updateBundle(bundle.id, { name: e.target.value })
              }
              className={inputClass}
            />
            <InfoRow label="Members">
              <span className="flex items-center gap-1">
                <Boxes className="size-3 text-muted" /> {memberCount}
              </span>
            </InfoRow>
            <InfoRow label="Loom Ø (est.)">{loomDiameterMm} mm</InfoRow>
            <div className="space-y-1">
              <label
                htmlFor="bundle-spacing"
                className="block text-xs text-secondary"
              >
                Sheath spacing (mm)
              </label>
              <input
                id="bundle-spacing"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={bundle.spacingMm}
                onChange={(e) =>
                  updateBundle(bundle.id, {
                    spacingMm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className={cn(inputClass, 'tabular-nums')}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Velcro straps</span>
              <Switch
                label="Render velcro straps"
                checked={bundle.straps ?? true}
                onChange={(straps) => updateBundle(bundle.id, { straps })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Highlight members</span>
              <Switch
                label="Highlight bundle members"
                checked={highlighted}
                onChange={(on) => setHighlight(on ? bundle.id : null)}
              />
            </div>
            {bundles.length > 1 && (
              <div className="space-y-1">
                <label
                  htmlFor="bundle-merge"
                  className="block text-xs text-secondary"
                >
                  Merge into
                </label>
                <select
                  id="bundle-merge"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    mergeBundles(bundle.id, e.target.value);
                    toast({ variant: 'success', title: 'Bundles merged' });
                  }}
                  className={selectClass}
                >
                  <option value="">Choose a bundle…</option>
                  {bundles
                    .filter((b) => b.id !== bundle.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {memberCount > 1 && (
              <button
                type="button"
                onClick={() => {
                  const created = splitBundle(bundle.id, [cable.id]);
                  if (created) {
                    toast({
                      variant: 'success',
                      title: `Moved into “${created.name}”`,
                    });
                  }
                }}
                className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-edge text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
              >
                <Scissors className="size-3" strokeWidth={1.75} />
                Split this cable out
              </button>
            )}
            <p className="text-[10.5px] leading-snug text-muted">
              Bundled cables run as one loom — through management hardware
              when available — and split near their ports.
            </p>
            <button
              type="button"
              onClick={() => {
                removeBundle(bundle.id);
                setHighlight(null);
                toast({ variant: 'success', title: 'Bundle dissolved' });
              }}
              className="flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
            >
              Dissolve bundle
            </button>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}

/* ---- presets ---------------------------------------------------------- */

function PresetSection({ cable }: { cable: CableInstance }) {
  const presets = useCablePresetsStore((s) => s.presets);
  const addPreset = useCablePresetsStore((s) => s.addPreset);
  const removePreset = useCablePresetsStore((s) => s.removePreset);
  const updateCable = useCableStore((s) => s.updateCable);
  const [name, setName] = useState('');

  const apply = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const spec = CABLE_CATALOG[preset.type];
    updateCable(cable.id, {
      type: preset.type,
      color: preset.color,
      nominalLengthMm: preset.lengthMm,
      thicknessMm: spec.diameterMm,
      bendRadiusMm: spec.minBendRadiusMm,
      manufacturer: preset.manufacturer,
      partNumber: preset.partNumber,
    });
    toast({ variant: 'success', title: `Applied “${preset.name}”` });
  };

  const save = () => {
    const label = name.trim() || `${CABLE_CATALOG[cable.type].name} ${formatLength(cable.nominalLengthMm)}`;
    addPreset({
      name: label,
      type: cable.type,
      color: cable.color,
      lengthMm: cable.nominalLengthMm,
      manufacturer: cable.manufacturer,
      partNumber: cable.partNumber,
    });
    setName('');
    toast({ variant: 'success', title: `Preset “${label}” saved` });
  };

  return (
    <CollapsibleSection title="Cable library" defaultOpen={false}>
      <div className="space-y-2">
        {presets.length > 0 && (
          <div className="space-y-1">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => apply(preset.id)}
                  className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-edge px-2 text-left text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
                  title={`Apply ${preset.name}`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="truncate">{preset.name}</span>
                  <span className="ml-auto shrink-0 text-muted">
                    {formatLength(preset.lengthMm)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete preset ${preset.name}`}
                  onClick={() => removePreset(preset.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            aria-label="New preset name"
            placeholder="Preset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={save}
            className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-edge px-2 text-[11px] font-medium text-secondary transition-colors hover:bg-raised"
          >
            <BookmarkPlus className="size-3.5" strokeWidth={1.75} />
            Save
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
