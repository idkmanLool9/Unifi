import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from './InfoRow';
import { getDevice } from '@/features/devices/deviceRegistry';
import { solveMounting, type MountingSolution } from '@/features/rack/mechanics';
import { useRackGeometry } from '@/features/rack/useRackGeometry';
import { useDragStore } from '@/stores/dragStore';
import { useRackStore } from '@/stores/rackStore';
import { cn } from '@/lib/utils';
import type { RackConfig } from '@/types';

const STYLE_LABELS: Record<MountingSolution['style'], string> = {
  'rack-ears': 'Rack ears',
  'sliding-rails': 'Sliding rails',
  'fixed-rails': 'Fixed rails',
  shelf: 'Shelf',
  'rear-brackets': 'Rear brackets',
  'four-post': 'Four-post',
  'two-post': 'Two-post',
  'wall-mount': 'Wall mount',
  desktop: 'Desktop',
};

/**
 * Compact live placement readout shown in the Inspector while a drag is
 * in progress: product, target rack and U range, facing, mounting style
 * and the current validation status. Purely informational — no controls.
 */
export function PlacementSection() {
  const dragging = useDragStore((s) => s.phase === 'dragging');
  const rack = useRackStore((s) => s.rack);
  if (!dragging || !rack) return null;
  return <PlacementBody rack={rack} />;
}

function PlacementBody({ rack }: { rack: RackConfig }) {
  const source = useDragStore((s) => s.source);
  const target = useDragStore((s) => s.target);
  const validation = useDragStore((s) => s.validation);
  const geometry = useRackGeometry(rack);

  const definition = source ? getDevice(source.definitionId) : undefined;
  if (!definition) return null;

  const endU = target ? target.startU + definition.rackUnits - 1 : null;
  const solution = solveMounting(definition, geometry);
  const status =
    target === null ? 'neutral' : validation?.ok ? 'valid' : 'invalid';

  return (
    <CollapsibleSection title="Placement">
      <div className="space-y-2">
        <InfoRow label="Product">{definition.productName}</InfoRow>
        <InfoRow label="Rack">{rack.name}</InfoRow>
        <InfoRow label="Target">
          {target && endU !== null
            ? target.startU === endU
              ? `U${target.startU}`
              : `U${target.startU}–U${endU}`
            : '—'}
        </InfoRow>
        <InfoRow label="Facing">
          {target ? (target.facing === 'front' ? 'Front' : 'Rear') : '—'}
        </InfoRow>
        <InfoRow label="Mounting">{STYLE_LABELS[solution.style]}</InfoRow>
        <InfoRow label="Status">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
              status === 'valid' && 'bg-success/15 text-success',
              status === 'invalid' && 'bg-danger/15 text-danger',
              status === 'neutral' && 'bg-surface-active text-muted',
            )}
          >
            {status === 'valid' && 'Valid'}
            {status === 'invalid' && 'Blocked'}
            {status === 'neutral' && 'No target'}
          </span>
        </InfoRow>
        {status === 'invalid' && validation && !validation.ok && (
          <p className="text-[10.5px] leading-snug text-danger">
            {validation.message}
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}
