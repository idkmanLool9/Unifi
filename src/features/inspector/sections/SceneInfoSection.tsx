import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useRackStore } from '@/stores/rackStore';
import { useViewportStore } from '@/stores/viewportStore';

const numberFormat = new Intl.NumberFormat('en-US');

export function SceneInfoSection() {
  const triangles = useViewportStore((s) => s.triangles);
  const drawCalls = useViewportStore((s) => s.drawCalls);
  const rack = useRackStore((s) => s.rack);

  return (
    <CollapsibleSection title="Scene Information">
      <InfoRow label="Objects">{rack ? 1 : 0}</InfoRow>
      <InfoRow label="Rack units">{rack ? `${rack.units}U` : '—'}</InfoRow>
      <InfoRow label="Triangles">{numberFormat.format(triangles)}</InfoRow>
      <InfoRow label="Draw calls">{drawCalls}</InfoRow>
      <InfoRow label="Grid pitch">0.50 m</InfoRow>
    </CollapsibleSection>
  );
}
