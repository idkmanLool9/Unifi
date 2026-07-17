import { resolvePhysicalPorts } from '@/features/devices/hardware/physicalPorts';
import { inCategoryNode } from './categoryTree';
import type { DeviceMeta } from './libraryMetaStore';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';
import type { PhysicalConnectorType } from '@/features/devices/hardware/physicalPorts';

/**
 * The library's query engine. Every definition is compiled once into a
 * LibraryEntry — a flat, pre-lowercased view model carrying everything
 * search, filters and cards need — and queries are then single linear
 * passes over plain fields. Compiling ~1k devices takes single-digit
 * milliseconds; querying 100k entries stays well under a frame.
 */

export type ReadinessLevel = 'blocker' | 'todo' | 'info';

export interface ReadinessIssue {
  code: string;
  label: string;
  level: ReadinessLevel;
}

export interface LibraryEntry {
  id: string;
  definition: DeviceDefinition;
  meta: DeviceMeta;
  /** Pre-lowercased searchable text. */
  haystack: string;
  portCount: number;
  portTypes: PhysicalConnectorType[];
  poe: boolean;
  etherlighting: boolean;
  authored: boolean;
  hasCableAnchors: boolean;
  ledCount: number;
  hasDisplay: boolean;
  hasCooling: boolean;
  issues: ReadinessIssue[];
  /** No blockers or todos left. */
  ready: boolean;
  /** Ready AND fully authored — the production badge. */
  verified: boolean;
}

/** Readiness heuristics over a definition (pure; model presence is an input). */
export function deriveReadiness(
  definition: DeviceDefinition,
  compiled: {
    portCount: number;
    authored: boolean;
    hasCableAnchors: boolean;
    ledCount: number;
  },
  modelAvailable: boolean,
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const isAccessory = definition.category === 'accessories';

  if (!modelAvailable) {
    issues.push({
      code: 'no-model',
      label: 'No 3D model — procedural placeholder renders instead',
      level: 'info',
    });
  }
  if (!definition.description || definition.tags.length === 0) {
    issues.push({
      code: 'missing-metadata',
      label: 'Missing description or tags',
      level: 'todo',
    });
  }
  if (compiled.portCount === 0 && !isAccessory) {
    issues.push({
      code: 'missing-ports',
      label: 'No ports defined',
      level: 'blocker',
    });
  }
  if (modelAvailable && !compiled.authored && !isAccessory) {
    issues.push({
      code: 'needs-authoring',
      label: 'Ports not hand-authored against the 3D model',
      level: 'todo',
    });
  }
  if (compiled.authored && compiled.portCount > 0 && !compiled.hasCableAnchors) {
    issues.push({
      code: 'missing-anchors',
      label: 'No cable anchors authored (insertion / exit direction)',
      level: 'todo',
    });
  }
  if (
    compiled.ledCount === 0 &&
    (definition.category === 'switching' || definition.category === 'routing')
  ) {
    issues.push({
      code: 'missing-leds',
      label: 'No status LEDs authored',
      level: 'info',
    });
  }
  return issues;
}

/** Compiles one definition + its meta into a query-ready entry. */
export function compileEntry(
  definition: DeviceDefinition,
  meta: DeviceMeta,
  modelAvailable: boolean,
): LibraryEntry {
  const ports = resolvePhysicalPorts(definition);
  const portTypes = [...new Set(ports.map((p) => p.type))];
  const authored = definition.portsAuthored === true;
  const hasCableAnchors = ports.some(
    (p) => p.insertionMm !== undefined || p.exitDirMm !== undefined,
  );
  const ledCount = definition.leds?.length ?? 0;

  const compiled = {
    portCount: ports.length,
    authored,
    hasCableAnchors,
    ledCount,
  };
  const issues = deriveReadiness(definition, compiled, modelAvailable);
  const ready = issues.every((i) => i.level === 'info');

  const haystack = [
    definition.productName,
    definition.manufacturerName,
    definition.manufacturer,
    definition.modelNumber,
    definition.slug,
    definition.category,
    definition.description,
    ...definition.tags,
    ...(meta.tags ?? []),
    meta.notes ?? '',
    ...portTypes,
    ports.some((p) => p.poe) ? 'poe' : '',
    definition.lighting?.etherlighting ? 'etherlighting' : '',
    definition.display?.lcd ? 'display lcd' : '',
    definition.cooling ? 'cooling fans' : '',
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: definition.id,
    definition,
    meta,
    haystack,
    portCount: ports.length,
    portTypes,
    poe: ports.some((p) => p.poe),
    etherlighting: definition.lighting?.etherlighting === true,
    authored,
    hasCableAnchors,
    ledCount,
    hasDisplay: definition.display?.lcd === true,
    hasCooling: definition.cooling !== undefined,
    issues,
    ready,
    verified: ready && authored,
  };
}

/* ---- filters ---------------------------------------------------------- */

export interface LibraryFilters {
  manufacturers: string[];
  rackUnits: number[];
  /** [min, max] mm; null bound = open. */
  depthMm?: [number | null, number | null];
  poe?: boolean;
  etherlighting?: boolean;
  portTypes: PhysicalConnectorType[];
  minPorts?: number;
  /** 3D model present. */
  modelAvailable?: boolean;
  authored?: boolean;
  verified?: boolean;
  hidden?: boolean;
}

export const EMPTY_FILTERS: LibraryFilters = {
  manufacturers: [],
  rackUnits: [],
  portTypes: [],
};

export function activeFilterCount(f: LibraryFilters): number {
  let n = 0;
  if (f.manufacturers.length) n++;
  if (f.rackUnits.length) n++;
  if (f.depthMm && (f.depthMm[0] !== null || f.depthMm[1] !== null)) n++;
  if (f.poe !== undefined) n++;
  if (f.etherlighting !== undefined) n++;
  if (f.portTypes.length) n++;
  if (f.minPorts !== undefined) n++;
  if (f.modelAvailable !== undefined) n++;
  if (f.authored !== undefined) n++;
  if (f.verified !== undefined) n++;
  return n;
}

export interface LibraryQuery {
  text: string;
  filters: LibraryFilters;
  /** Category tree node (built-in or custom), or null for all. */
  categoryNode: string | null;
  modelAvailability: (entry: LibraryEntry) => boolean;
}

/** Applies search text + filters + category to the compiled entries. */
export function queryEntries(
  entries: readonly LibraryEntry[],
  query: {
    text: string;
    filters: LibraryFilters;
    categoryNode: string | null;
  },
): LibraryEntry[] {
  const terms = query.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const f = query.filters;

  return entries.filter((entry) => {
    if (entry.meta.hidden && f.hidden !== true) return false;
    if (terms.length && !terms.every((t) => entry.haystack.includes(t))) {
      return false;
    }
    if (
      query.categoryNode &&
      !inCategoryNode(
        entry.definition,
        query.categoryNode,
        entry.meta.customCategoryId,
      )
    ) {
      return false;
    }
    if (
      f.manufacturers.length &&
      !f.manufacturers.includes(entry.definition.manufacturer)
    ) {
      return false;
    }
    if (f.rackUnits.length && !f.rackUnits.includes(entry.definition.rackUnits)) {
      return false;
    }
    if (f.depthMm) {
      const [min, max] = f.depthMm;
      if (min !== null && entry.definition.depthMm < min) return false;
      if (max !== null && entry.definition.depthMm > max) return false;
    }
    if (f.poe !== undefined && entry.poe !== f.poe) return false;
    if (
      f.etherlighting !== undefined &&
      entry.etherlighting !== f.etherlighting
    ) {
      return false;
    }
    if (
      f.portTypes.length &&
      !f.portTypes.some((t) => entry.portTypes.includes(t))
    ) {
      return false;
    }
    if (f.minPorts !== undefined && entry.portCount < f.minPorts) return false;
    if (f.authored !== undefined && entry.authored !== f.authored) return false;
    if (f.verified !== undefined && entry.verified !== f.verified) return false;
    return true;
  });
}

export type LibrarySort = 'name' | 'manufacturer' | 'units' | 'ports' | 'recent';

export function sortEntries(
  entries: LibraryEntry[],
  sort: LibrarySort,
  recentIds: readonly string[],
): LibraryEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'name':
      sorted.sort((a, b) =>
        a.definition.productName.localeCompare(b.definition.productName),
      );
      break;
    case 'manufacturer':
      sorted.sort(
        (a, b) =>
          a.definition.manufacturerName.localeCompare(
            b.definition.manufacturerName,
          ) ||
          a.definition.productName.localeCompare(b.definition.productName),
      );
      break;
    case 'units':
      sorted.sort(
        (a, b) =>
          a.definition.rackUnits - b.definition.rackUnits ||
          a.definition.productName.localeCompare(b.definition.productName),
      );
      break;
    case 'ports':
      sorted.sort((a, b) => b.portCount - a.portCount);
      break;
    case 'recent':
      sorted.sort((a, b) => {
        const ai = recentIds.indexOf(a.id);
        const bi = recentIds.indexOf(b.id);
        return (ai === -1 ? 1e9 : ai) - (bi === -1 ? 1e9 : bi);
      });
      break;
  }
  return sorted;
}
