import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  FolderOpen,
  LayoutTemplate,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { LogoMark } from '@/components/ui/LogoMark';
import { useRackStore } from '@/stores/rackStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useViewportStore } from '@/stores/viewportStore';
import { RACK_SIZES, U_METERS, rackHeight } from './rackConstants';
import { cn } from '@/lib/utils';
import type { RackSize } from '@/types';

const EASE = [0.32, 0.72, 0, 1] as const;

function SecondaryOption({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-edge bg-surface-raised/60 px-2 py-3 opacity-70 transition-colors"
    >
      <Icon className="size-4 text-muted" strokeWidth={1.75} />
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <span className="absolute top-1.5 right-1.5 rounded-sm bg-surface-active px-1 py-px text-[9px] font-semibold tracking-wide text-muted uppercase">
        Soon
      </span>
    </button>
  );
}

function SizeCard({
  units,
  active,
  onSelect,
}: {
  units: RackSize;
  active: boolean;
  onSelect: () => void;
}) {
  // Mini rack glyph: bar height tracks real proportions.
  const glyphH = 14 + (units / 42) * 34;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border px-2 pt-3 pb-2.5 transition-colors duration-100',
        active
          ? 'border-accent bg-accent-soft'
          : 'border-edge bg-surface-raised/60 hover:border-edge-strong hover:bg-surface-hover',
      )}
    >
      <span className="flex h-12 items-end">
        <span
          className={cn(
            'block w-5 rounded-[3px] border-2 transition-colors',
            active ? 'border-accent' : 'border-edge-strong',
          )}
          style={{ height: glyphH }}
        >
          <span
            className={cn(
              'mx-auto mt-[3px] block h-[2px] w-2.5 rounded-full',
              active ? 'bg-accent' : 'bg-edge-strong',
            )}
          />
        </span>
      </span>
      <span className="text-center leading-tight">
        <span
          className={cn(
            'block text-[13px] font-semibold',
            active ? 'text-accent' : 'text-primary',
          )}
        >
          {units}U
        </span>
        <span className="block text-[10px] text-muted tabular-nums">
          ≈ {rackHeight(units).toFixed(2)} m
        </span>
      </span>
    </motion.button>
  );
}

/**
 * Empty-state overlay shown while no rack exists: a focused welcome card
 * with a two-step create flow (menu → rack height), plus visual
 * placeholders for templates, import, and recents.
 */
export function WelcomeOverlay() {
  const [step, setStep] = useState<'menu' | 'size'>('menu');
  const [units, setUnits] = useState<RackSize>(12);
  const createRack = useRackStore((s) => s.createRack);
  const dispatchCamera = useViewportStore((s) => s.dispatchCamera);

  const handleCreate = () => {
    createRack(units);
    // Select it so the inspector opens on the rack, then fly to the hero
    // three-quarter angle framed around the new rack.
    useSelectionStore.getState().selectRack();
    dispatchCamera({ type: 'preset', view: 'perspective' });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="glass-panel pointer-events-auto w-[420px] rounded-2xl p-7 shadow-overlay"
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === 'menu' ? (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <LogoMark className="size-11 rounded-xl" />
              <h1 className="mt-4 text-lg font-semibold tracking-tight">
                Design your first rack
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-secondary">
                Start from an empty open-frame rack and build your layout in
                full 3D.
              </p>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('size')}
                className="mt-5 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[13px] font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover"
              >
                <Plus className="size-4" strokeWidth={2} />
                Create New Rack
              </motion.button>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <SecondaryOption icon={LayoutTemplate} label="Templates" />
                <SecondaryOption icon={FolderOpen} label="Import" />
                <SecondaryOption icon={Clock} label="Recent" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="size"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <h1 className="text-lg font-semibold tracking-tight">
                Choose rack height
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-secondary">
                Standard 19-inch frame · 1U = {(U_METERS * 1000).toFixed(2)}
                &thinsp;mm. You can change this later.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {RACK_SIZES.map((size) => (
                  <SizeCard
                    key={size}
                    units={size}
                    active={units === size}
                    onSelect={() => setUnits(size)}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('menu')}
                  className="flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  Back
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  className="flex h-9 flex-1 items-center justify-center rounded-[10px] bg-accent text-[13px] font-medium text-on-accent shadow-xs transition-colors hover:bg-accent-hover"
                >
                  Create {units}U Rack
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
