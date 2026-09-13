import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRICING_STORE_KEY } from '@/lib/constants';
import type { CurrencyCode } from '@/features/devices/pricing';

interface PricingState {
  /** Display currency for the bill of materials. */
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
}

/** Persisted pricing preferences. The bill of materials itself is derived
 *  from the (already persisted) rack and placed devices — only the display
 *  currency needs its own storage. */
export const usePricingStore = create<PricingState>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
    }),
    { name: PRICING_STORE_KEY, version: 1 },
  ),
);
