import { motion } from 'framer-motion';
import {
  Focus,
  Grid3x3,
  RotateCcw,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { useViewportStore } from '@/stores/viewportStore';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex h-[54px] flex-col items-center justify-center gap-1 rounded-[10px] border border-edge bg-surface-raised text-secondary shadow-xs transition-colors duration-100 hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
    >
      <Icon className="size-4" strokeWidth={1.75} />
      <span className="text-[10px] font-medium">{label}</span>
    </motion.button>
  );
}

export function QuickActionsSection() {
  const dispatchCamera = useViewportStore((s) => s.dispatchCamera);
  const toggleGrid = useViewSettingsStore((s) => s.toggleGrid);

  return (
    <CollapsibleSection title="Quick Actions">
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton
          icon={Focus}
          label="Fit view"
          onClick={() => dispatchCamera({ type: 'fit' })}
        />
        <ActionButton
          icon={RotateCcw}
          label="Reset camera"
          onClick={() => dispatchCamera({ type: 'reset' })}
        />
        <ActionButton
          icon={Square}
          label="Top view"
          onClick={() => dispatchCamera({ type: 'preset', view: 'top' })}
        />
        <ActionButton icon={Grid3x3} label="Toggle grid" onClick={toggleGrid} />
      </div>
    </CollapsibleSection>
  );
}
