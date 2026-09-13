import { getDevice, useRegistryStore } from '@/features/devices/deviceRegistry';
import { priceForDevice, priceForProfile } from '@/features/devices/pricing';
import { getProfile } from '@/features/rack/rackProfiles';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useRackStore } from '@/stores/rackStore';
import type { PlacedDevice } from '@/features/rack/rackMath';
import type { RackConfig } from '@/types';

/** Minimal device shape the bill of materials needs to name a line. */
export interface BomDeviceInfo {
  id: string;
  productName: string;
  manufacturerName: string;
}

export type BomLineKind = 'rack' | 'device';

export interface BomLine {
  /** Stable React key (rack id or device definition id). */
  key: string;
  kind: BomLineKind;
  name: string;
  /** Secondary label (manufacturer, or "Enclosure" for the rack). */
  sublabel: string;
  qty: number;
  /** Unit price in USD, or undefined when we have no estimate. */
  unitUsd?: number;
  /** qty × unit, or undefined when unpriced. */
  lineUsd?: number;
}

export interface BillOfMaterials {
  lines: BomLine[];
  /** Sum of every priced line, USD. */
  subtotalUsd: number;
  /** Total physical items (rack + every device unit). */
  itemCount: number;
  /** True when at least one line has no price estimate. */
  hasUnpriced: boolean;
}

/**
 * Pure derivation of the bill of materials from a rack and its placed
 * devices. Devices are grouped by type into quantity lines; the
 * rack/enclosure is its own line. `resolveDevice` maps a definition id to
 * its naming info (the registry lookup, injected so this stays testable).
 */
export function computeBom(
  rack: RackConfig | null,
  instances: readonly PlacedDevice[],
  resolveDevice: (id: string) => BomDeviceInfo | undefined,
): BillOfMaterials {
  const lines: BomLine[] = [];

  if (rack) {
    const profile = getProfile(rack.profileId);
    const unitUsd = priceForProfile(rack.profileId);
    lines.push({
      key: `rack:${rack.id}`,
      kind: 'rack',
      name: profile.name,
      sublabel: 'Enclosure',
      qty: 1,
      unitUsd,
      lineUsd: unitUsd,
    });
  }

  // Group placed devices by definition, preserving first-placed order.
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const inst of instances) {
    const n = counts.get(inst.definitionId);
    if (n === undefined) order.push(inst.definitionId);
    counts.set(inst.definitionId, (n ?? 0) + 1);
  }

  for (const definitionId of order) {
    const definition = resolveDevice(definitionId);
    if (!definition) continue;
    const qty = counts.get(definitionId) ?? 0;
    const unitUsd = priceForDevice(definition);
    lines.push({
      key: `device:${definitionId}`,
      kind: 'device',
      name: definition.productName,
      sublabel: definition.manufacturerName,
      qty,
      unitUsd,
      lineUsd: unitUsd === undefined ? undefined : unitUsd * qty,
    });
  }

  const subtotalUsd = lines.reduce((sum, l) => sum + (l.lineUsd ?? 0), 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const hasUnpriced = lines.some((l) => l.unitUsd === undefined);

  return { lines, subtotalUsd, itemCount, hasUnpriced };
}

/**
 * The build's bill of materials, derived from the current rack and placed
 * devices. Pure derivation of already-persisted state, so the cart persists
 * with the project for free.
 */
export function useBillOfMaterials(): BillOfMaterials {
  const rack = useRackStore((s) => s.rack);
  const instances = useDeviceInstancesStore((s) => s.instances);
  // Re-derive when external device definitions finish loading.
  useRegistryStore((s) => s.version);
  return computeBom(rack, instances, getDevice);
}
