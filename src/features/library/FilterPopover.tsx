import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { CATALOG_BRANDS, devicesByBrand } from './catalog';
import { cn } from '@/lib/utils';

/**
 * Visual design of the library filter experience. Selections are local UI
 * state only — real filtering lands with the catalog backend.
 */

const UNIT_OPTIONS = ['1U', '2U', '3U', '4U+'];
const SPEED_OPTIONS = ['1G', '10G', '25G+'];

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="pb-1.5 text-[9.5px] font-semibold tracking-[0.08em] text-muted uppercase">
      {children}
    </p>
  );
}

export function FilterPopover({ onClose }: { onClose: () => void }) {
  const [brands, setBrands] = useState<string[]>(['ubiquiti']);
  const [units, setUnits] = useState<string[]>([]);
  const [speeds, setSpeeds] = useState<string[]>([]);
  const [poeOnly, setPoeOnly] = useState(false);
  const [shortDepth, setShortDepth] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.99 }}
      transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
      className="absolute inset-x-3 top-[52px] z-30 rounded-xl border border-edge bg-surface p-3 shadow-overlay"
    >
      <div className="space-y-3.5">
        <div>
          <GroupLabel>Manufacturer</GroupLabel>
          <div className="max-h-[132px] space-y-px overflow-y-auto pr-1">
            {CATALOG_BRANDS.map((brand) => {
              const active = brands.includes(brand.id);
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => toggle(brands, setBrands, brand.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-hover"
                >
                  <span
                    className={cn(
                      'flex size-3.5 items-center justify-center rounded-[4px] border transition-colors',
                      active
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge-strong bg-surface-raised',
                    )}
                  >
                    {active && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 text-xs text-primary">{brand.name}</span>
                  <span className="text-[10px] text-muted tabular-nums">
                    {devicesByBrand(brand.id).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <GroupLabel>Rack units</GroupLabel>
            <div className="flex flex-wrap gap-1">
              {UNIT_OPTIONS.map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={units.includes(u)}
                  onClick={() => toggle(units, setUnits, u)}
                  className={cn(
                    'h-6 rounded-md px-2 text-[11px] font-medium transition-colors',
                    units.includes(u)
                      ? 'bg-accent text-on-accent'
                      : 'bg-surface-active text-secondary hover:text-primary',
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div>
            <GroupLabel>Network speed</GroupLabel>
            <div className="flex flex-wrap gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speeds.includes(s)}
                  onClick={() => toggle(speeds, setSpeeds, s)}
                  className={cn(
                    'h-6 rounded-md px-2 text-[11px] font-medium transition-colors',
                    speeds.includes(s)
                      ? 'bg-accent text-on-accent'
                      : 'bg-surface-active text-secondary hover:text-primary',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary">PoE capable only</span>
            <Switch label="PoE capable only" checked={poeOnly} onChange={setPoeOnly} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary">
              Short depth (≤ 350 mm)
            </span>
            <Switch
              label="Short depth"
              checked={shortDepth}
              onChange={setShortDepth}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-edge pt-2.5">
          <button
            type="button"
            onClick={() => {
              setBrands([]);
              setUnits([]);
              setSpeeds([]);
              setPoeOnly(false);
              setShortDepth(false);
            }}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Apply filters
          </button>
        </div>
      </div>
    </motion.div>
  );
}
