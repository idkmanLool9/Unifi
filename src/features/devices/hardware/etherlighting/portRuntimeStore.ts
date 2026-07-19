import { create } from 'zustand';
import { cableForPort } from '@/stores/cableStore';
import type { CableInstance } from '@/stores/cableStore';

/**
 * Live per-port runtime state — the integration surface for future
 * UniFi API / SNMP / simulation feeds. Nothing in the renderer knows
 * where a state came from: an explicit runtime entry always wins, and
 * in its absence link status derives from the planned cabling (a port
 * with a cable is "up"). Writing here from a live data source lights
 * the rack without any renderer changes.
 */

/**
 * Operational state of a connected port, for the activity color mode.
 * `up` is a healthy link; `down` is connected-but-no-link (shown red);
 * `warning` is a degraded/faulted link (amber); `disabled` is admin-down
 * (unlit). Absent means "derive from the cable plan" (connected → up).
 */
export type PortLinkStatus = 'up' | 'down' | 'warning' | 'disabled';

export interface PortRuntime {
  /** Link up/down. */
  link?: boolean;
  /** Explicit operational state (overrides the cable-derived link). */
  status?: PortLinkStatus;
  /** Negotiated speed, Gbps (overrides the authored port speed). */
  speedGbps?: number;
  /** Traffic activity 0–1 (drives activity/traffic animations). */
  activity?: number;
  /** PoE actively delivering. */
  poeActive?: boolean;
}

const keyOf = (instanceId: string, portRef: string): string =>
  `${instanceId}:${portRef}`;

interface PortRuntimeState {
  states: Record<string, PortRuntime>;
  setPortState: (
    instanceId: string,
    portRef: string,
    state: PortRuntime | undefined,
  ) => void;
  clearAll: () => void;
}

export const usePortRuntimeStore = create<PortRuntimeState>()((set) => ({
  states: {},
  setPortState: (instanceId, portRef, state) =>
    set((s) => {
      const next = { ...s.states };
      const key = keyOf(instanceId, portRef);
      if (state === undefined) delete next[key];
      else next[key] = state;
      return { states: next };
    }),
  clearAll: () => set({ states: {} }),
}));

/**
 * Effective runtime for a port: explicit state first, else link
 * derived from the cable plan.
 */
export function effectiveRuntime(
  states: Record<string, PortRuntime>,
  cables: readonly CableInstance[],
  instanceId: string | undefined,
  portRef: string,
): PortRuntime {
  const explicit = instanceId ? states[keyOf(instanceId, portRef)] : undefined;
  if (explicit) return explicit;
  if (!instanceId) return {};
  const cable = cableForPort(cables, { deviceInstanceId: instanceId, portRef });
  return { link: cable !== undefined };
}
