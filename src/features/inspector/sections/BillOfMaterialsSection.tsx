import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useBillOfMaterials } from '@/features/cart/billOfMaterials';
import { formatMoney, type CurrencyCode } from '@/features/devices/pricing';
import { usePricingStore } from '@/stores/pricingStore';

const CURRENCY_OPTIONS: ReadonlyArray<{ value: CurrencyCode; label: string }> = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];

/**
 * Bill of materials for the current build: the rack plus every placed
 * device grouped into quantity lines, with a running total in the chosen
 * display currency. Prices are indicative estimates.
 */
export function BillOfMaterialsSection() {
  const bom = useBillOfMaterials();
  const currency = usePricingStore((s) => s.currency);
  const setCurrency = usePricingStore((s) => s.setCurrency);
  const empty = bom.lines.length === 0;

  return (
    <CollapsibleSection title="Bill of Materials">
      <div className="space-y-2.5">
        <SegmentedControl
          label="Display currency"
          value={currency}
          onChange={setCurrency}
          options={CURRENCY_OPTIONS}
        />

        {empty ? (
          <p className="py-1 text-[11px] leading-snug text-muted">
            Add a rack and devices to see the build cost.
          </p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {bom.lines.map((line) => {
                const unitText =
                  line.unitUsd === undefined
                    ? 'no estimate'
                    : line.qty > 1
                      ? `${line.qty} × ${formatMoney(line.unitUsd, currency)}`
                      : formatMoney(line.unitUsd, currency);
                return (
                  <li
                    key={line.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs text-primary">
                        {line.name}
                      </div>
                      <div className="truncate text-[10px] text-muted">
                        {line.sublabel} · {unitText}
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-primary">
                      {line.lineUsd === undefined
                        ? '—'
                        : formatMoney(line.lineUsd, currency)}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-edge pt-2">
              <span className="text-xs font-semibold text-primary">Total</span>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {formatMoney(bom.subtotalUsd, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>
                {bom.itemCount} item{bom.itemCount === 1 ? '' : 's'} · estimated
              </span>
              {bom.hasUnpriced && <span>“—” = no estimate</span>}
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
