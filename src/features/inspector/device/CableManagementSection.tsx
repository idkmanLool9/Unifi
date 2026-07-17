import { AlertTriangle, Info } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { InfoRow } from '../InfoRow';
import {
  buildRoutingGraph,
  managerUsage,
  occupancyFromCables,
} from '@/features/cables/engine/managedRouting';
import { getDevice, registerDevice } from '@/features/devices/deviceRegistry';
import { rackGeometryFor, deepestDeviceDepthMm } from '@/features/rack/rackMath';
import { useLibraryMetaStore } from '@/features/library/workspace/libraryMetaStore';
import { useCableStore } from '@/stores/cableStore';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import { useRoutingRulesStore } from '@/stores/routingRulesStore';
import { cn } from '@/lib/utils';
import type { PlacedDevice } from '@/features/rack/rackMath';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * Inspector for cable-management hardware: live capacity/occupancy from
 * the routed cables, editable routing priority (persists as a
 * definition patch), the node layout, actionable warnings — plus the
 * global routing rules, editable in place.
 */
export function CableManagementSection({
  instance,
  definition,
}: {
  instance: PlacedDevice;
  definition: DeviceDefinition;
}) {
  const spec = definition.cableManagement;
  const cables = useCableStore((s) => s.cables);
  const instances = useDeviceInstancesStore((s) => s.instances);
  const rack = useRackStore((s) => s.rack);
  const rules = useRoutingRulesStore((s) => s.rules);
  const patchRules = useRoutingRulesStore((s) => s.patchRules);
  const setDefinitionPatch = useLibraryMetaStore((s) => s.setDefinitionPatch);

  if (!spec || !rack) return null;

  const geometry = rackGeometryFor(rack, deepestDeviceDepthMm(instances, getDevice));
  const graph = buildRoutingGraph(instances, getDevice, geometry);
  const occupancy = occupancyFromCables(cables);
  const usage = managerUsage(instance.id, graph, occupancy);

  const fillRatio = usage.capacity > 0 ? usage.used / usage.capacity : 0;
  const overfilled = usage.perNode.some((n) => n.used > n.capacity);
  const nearCapacity = fillRatio >= 0.8 && !overfilled;
  const unused = usage.used === 0 && cables.length > 0;

  const setPriority = (costFactor: number) => {
    const current = getDevice(definition.id);
    if (!current?.cableManagement) return;
    const patch = {
      cableManagement: { ...current.cableManagement, costFactor },
    };
    registerDevice({ ...current, ...patch });
    setDefinitionPatch(definition.id, patch);
  };

  return (
    <CollapsibleSection title="Cable management">
      <div className="space-y-2.5">
        <InfoRow label="Type">{spec.kind.replace('-', ' ')}</InfoRow>
        <InfoRow label="Capacity">
          {usage.used} / {usage.capacity} cables
        </InfoRow>

        {/* Fill bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              overfilled
                ? 'bg-danger'
                : nearCapacity
                  ? 'bg-warning'
                  : 'bg-success',
            )}
            style={{ width: `${Math.min(100, fillRatio * 100)}%` }}
          />
        </div>

        {spec.preferredFamilies && (
          <InfoRow label="Intended for">
            {spec.preferredFamilies.join(', ')}
          </InfoRow>
        )}
        {spec.enclosed && <InfoRow label="Style">Enclosed</InfoRow>}

        {/* Priority: lower cost attracts more routes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary">Routing priority</span>
            <span className="text-[10px] tabular-nums text-muted">
              cost ×{(spec.costFactor ?? 1).toFixed(2)}
            </span>
          </div>
          <Slider
            label="Routing priority (lower cost attracts routes)"
            min={0.3}
            max={2}
            step={0.05}
            value={spec.costFactor ?? 1}
            onChange={setPriority}
          />
          <p className="text-[10px] leading-snug text-muted">
            Lower cost pulls more cables through this hardware.
          </p>
        </div>

        {/* Node layout */}
        <div className="space-y-1">
          <span className="text-xs text-secondary">Routing nodes</span>
          {usage.perNode.map((node) => (
            <div
              key={node.key}
              className="flex items-center justify-between rounded-md bg-raised px-2 py-1 text-[10.5px]"
            >
              <span className="font-medium text-secondary">{node.nodeId}</span>
              <span
                className={cn(
                  'tabular-nums',
                  node.used > node.capacity
                    ? 'text-danger'
                    : node.used >= node.capacity * 0.8
                      ? 'text-warning'
                      : 'text-muted',
                )}
              >
                {node.used}/{node.capacity}
              </span>
            </div>
          ))}
        </div>

        {/* Actionable findings */}
        {overfilled && (
          <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-danger">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            Overfilled — add a second manager nearby or raise this one's
            cost so new routes spread out.
          </p>
        )}
        {nearCapacity && (
          <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-warning">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            Approaching capacity — plan expansion before adding many more
            runs.
          </p>
        )}
        {unused && (
          <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-muted">
            <Info className="mt-0.5 size-3 shrink-0" />
            No cables use this manager yet — lower its cost or move it
            between the patch field and the switch.
          </p>
        )}

        {/* Global routing rules */}
        <div className="space-y-2 border-t border-edge pt-2">
          <span className="text-xs font-medium text-secondary">
            Routing rules (global)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary">Separate power & data</span>
            <Switch
              label="Separate power and data"
              checked={rules.separatePowerData}
              onChange={(separatePowerData) => patchRules({ separatePowerData })}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">Manager preference</span>
              <span className="text-[10px] tabular-nums text-muted">
                ×{rules.managerPreference.toFixed(1)}
              </span>
            </div>
            <Slider
              label="How strongly routes prefer managers"
              min={1}
              max={3}
              step={0.1}
              value={rules.managerPreference}
              onChange={(managerPreference) => patchRules({ managerPreference })}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="rule-dac"
              className="block text-xs text-secondary"
            >
              DAC length warning (mm)
            </label>
            <input
              id="rule-dac"
              type="number"
              min={500}
              step={500}
              value={rules.dacMaxLengthMm}
              onChange={(e) =>
                patchRules({
                  dacMaxLengthMm: Math.max(500, Number(e.target.value) || 3000),
                })
              }
              className="h-7 w-full rounded-lg border border-edge bg-surface-raised px-2 text-xs font-medium tabular-nums text-primary focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
