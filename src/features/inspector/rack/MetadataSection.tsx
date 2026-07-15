import { Trash2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import { useRackStore } from '@/stores/rackStore';
import type { RackConfig } from '@/types';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function MetadataSection({ rack }: { rack: RackConfig }) {
  const deleteRack = useRackStore((s) => s.deleteRack);

  return (
    <CollapsibleSection title="Metadata" defaultOpen={false}>
      <div className="space-y-2">
        <InfoRow label="ID">
          <span className="font-mono text-[10px]">
            {rack.id.slice(0, 8)}
          </span>
        </InfoRow>
        <InfoRow label="Created">
          {dateFormat.format(new Date(rack.createdAt))}
        </InfoRow>
        <InfoRow label="Modified">Just now</InfoRow>
        <InfoRow label="Author">You</InfoRow>

        <button
          type="button"
          onClick={deleteRack}
          className="mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          Delete rack
        </button>
      </div>
    </CollapsibleSection>
  );
}
