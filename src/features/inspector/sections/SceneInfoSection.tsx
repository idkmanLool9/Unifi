import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useViewportStore } from '@/stores/viewportStore';

const numberFormat = new Intl.NumberFormat('en-US');

export function SceneInfoSection() {
  const triangles = useViewportStore((s) => s.triangles);
  const drawCalls = useViewportStore((s) => s.drawCalls);

  return (
    <CollapsibleSection title="Scene Information">
      <InfoRow label="Objects">0</InfoRow>
      <InfoRow label="Rack units">—</InfoRow>
      <InfoRow label="Triangles">{numberFormat.format(triangles)}</InfoRow>
      <InfoRow label="Draw calls">{drawCalls}</InfoRow>
      <InfoRow label="Grid pitch">0.50 m</InfoRow>
    </CollapsibleSection>
  );
}
