import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * The library's nested category tree. Built-in nodes classify every
 * definition from its metadata (category + accessory kind + tags) —
 * devices never store a tree path, so the taxonomy can evolve freely.
 * User-created categories append as custom nodes; devices are assigned
 * to them explicitly through the inspector.
 */

export interface CategoryNode {
  id: string;
  label: string;
  children?: CategoryNode[];
  /** Present on user-created nodes. */
  custom?: boolean;
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'network',
    label: 'Network',
    children: [
      { id: 'network/switches', label: 'Switches' },
      { id: 'network/routing', label: 'Routers & Gateways' },
      { id: 'network/firewalls', label: 'Firewalls' },
      { id: 'network/wireless', label: 'Wireless' },
    ],
  },
  { id: 'servers', label: 'Servers' },
  { id: 'storage', label: 'Storage' },
  {
    id: 'power',
    label: 'Power',
    children: [
      { id: 'power/ups', label: 'UPS' },
      { id: 'power/pdu', label: 'PDUs' },
      { id: 'power/supplies', label: 'Power Supplies' },
    ],
  },
  {
    id: 'accessories',
    label: 'Rack Accessories',
    children: [
      { id: 'accessories/patch-panels', label: 'Patch Panels' },
      { id: 'accessories/cable-management', label: 'Cable Management' },
      { id: 'accessories/shelves', label: 'Shelves' },
      { id: 'accessories/blank-panels', label: 'Blank Panels' },
      { id: 'accessories/other', label: 'Other' },
    ],
  },
];

/** Tree node ids a definition belongs to (leaf first, then ancestors). */
export function classifyDevice(definition: DeviceDefinition): string[] {
  const tags = definition.tags.map((t) => t.toLowerCase());
  const has = (t: string) =>
    tags.some((tag) => tag.includes(t)) ||
    definition.productName.toLowerCase().includes(t) ||
    definition.description.toLowerCase().includes(t);

  switch (definition.category) {
    case 'switching':
      return ['network/switches', 'network'];
    case 'routing':
      if (has('firewall')) return ['network/firewalls', 'network'];
      if (has('access point') || has('wireless')) {
        return ['network/wireless', 'network'];
      }
      return ['network/routing', 'network'];
    case 'servers':
      return ['servers'];
    case 'storage':
      return ['storage'];
    case 'power': {
      if (definition.accessoryKind === 'pdu' || has('pdu')) {
        return ['power/pdu', 'power'];
      }
      if (has('ups') || has('uninterruptible')) return ['power/ups', 'power'];
      return ['power/supplies', 'power'];
    }
    case 'accessories': {
      switch (definition.accessoryKind) {
        case 'patch-panel':
          return ['accessories/patch-panels', 'accessories'];
        case 'cable-manager':
        case 'brush-panel':
          return ['accessories/cable-management', 'accessories'];
        case 'cantilever-shelf':
        case 'fixed-shelf':
          return ['accessories/shelves', 'accessories'];
        case 'blank-panel':
          return ['accessories/blank-panels', 'accessories'];
        case 'pdu':
          return ['power/pdu', 'power'];
        default:
          return ['accessories/other', 'accessories'];
      }
    }
  }
}

/** True when the device belongs to `nodeId` (or any of its descendants). */
export function inCategoryNode(
  definition: DeviceDefinition,
  nodeId: string,
  customAssignment: string | undefined,
): boolean {
  if (customAssignment === nodeId) return true;
  return classifyDevice(definition).includes(nodeId);
}

/** Flat list of every built-in node (parents before children). */
export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children) out.push(...flattenTree(node.children));
  }
  return out;
}

export function nodeLabel(nodeId: string): string {
  const node = flattenTree(CATEGORY_TREE).find((n) => n.id === nodeId);
  return node?.label ?? nodeId;
}
