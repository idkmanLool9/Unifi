import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_RULES, type RoutingRules } from '@/features/cables/engine/managedRouting';

/**
 * User-customizable routing rules. The managed router consumes exactly
 * this shape; changing a rule reroutes every affected cable live.
 */

interface RoutingRulesState {
  rules: RoutingRules;
  patchRules: (patch: Partial<RoutingRules>) => void;
  resetRules: () => void;
}

export const useRoutingRulesStore = create<RoutingRulesState>()(
  persist(
    (set) => ({
      rules: DEFAULT_RULES,
      patchRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
    }),
    { name: 'rackforge-routing-rules' },
  ),
);
