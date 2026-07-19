import type { CabinetModelDef } from './cabinetSchema';
import type { RackProfileId } from '@/features/rack/rackProfiles';

/**
 * Registry of interactive cabinet models. Each entry is pure metadata:
 * a GLB plus the parts, matched to GLB node names, that describe how the
 * enclosure comes apart. Nothing here is cabinet-specific in the renderer
 * or UI — they consume this data generically.
 *
 * Ubiquiti UACC 12U 600mm wall-mount cabinet. Model measured at
 * 600×644×610 mm, centred at the origin, Y up, glass door toward +Z.
 * Right-hinged front door (pivot on the +X front edge), two removable
 * side panels, lift-off top / bottom covers, a wall-side back, four
 * interior mounting rails and two roof fans.
 */
const UACC_WALL_12U: CabinetModelDef = {
  id: 'uacc-wall-12u-600',
  name: 'UACC 12U 600mm Wall Cabinet',
  modelPath: 'cabinets/uacc-wall-12u-600/model.glb',
  rackUnits: 12,
  sizeMm: [600, 644, 610],
  animationMs: 550,
  parts: [
    {
      id: 'front-door',
      name: 'Front Door',
      kind: 'door',
      interaction: 'hinge',
      group: 'front',
      // Door leaf + lock + the moving (door-side) hinge knuckles/leaves.
      // Listed before `frame`, which catches the static hinge parts.
      nodes: [
        'Cab-Door-*',
        'Door-Lock-*',
        'Hinge-0-LeafD',
        'Hinge-0-KnuckleD',
        'Hinge-1-LeafD',
        'Hinge-1-KnuckleD',
      ],
      hinge: { pivotMm: [283, 0, 301], axis: 'y', openDeg: 105, maxDeg: 120 },
      explode: { dirMm: [0, 0, 1], distanceMm: 260 },
      defaultState: 'closed',
      states: ['closed', 'open'],
      supportsTransparency: true,
      obstructsInterior: true,
    },
    {
      id: 'side-left',
      name: 'Left Side Panel',
      kind: 'side-panel',
      interaction: 'remove',
      group: 'left',
      nodes: ['Cab-Side-L'],
      move: { dirMm: [-1, 0, 0], distanceMm: 150 },
      explode: { dirMm: [-1, 0, 0], distanceMm: 220 },
      defaultState: 'installed',
      states: ['installed', 'hidden', 'removed'],
      supportsTransparency: true,
      obstructsInterior: true,
    },
    {
      id: 'side-right',
      name: 'Right Side Panel',
      kind: 'side-panel',
      interaction: 'remove',
      group: 'right',
      nodes: ['Cab-Side-R'],
      move: { dirMm: [1, 0, 0], distanceMm: 150 },
      explode: { dirMm: [1, 0, 0], distanceMm: 220 },
      defaultState: 'installed',
      states: ['installed', 'hidden', 'removed'],
      supportsTransparency: true,
      obstructsInterior: true,
    },
    {
      id: 'top-cover',
      name: 'Top Cover',
      kind: 'top-cover',
      interaction: 'lift',
      group: 'top',
      nodes: ['Cab-Top', 'Cab-Top-CableLip', 'Cab-GlandPlate', 'Cab-Gland-Scr-*'],
      move: { dirMm: [0, 1, 0], distanceMm: 130 },
      explode: { dirMm: [0, 1, 0], distanceMm: 200 },
      defaultState: 'installed',
      states: ['installed', 'hidden', 'removed'],
      supportsTransparency: true,
      obstructsInterior: false,
    },
    {
      id: 'bottom-cover',
      name: 'Bottom Cover',
      kind: 'bottom-cover',
      interaction: 'lift',
      group: 'bottom',
      nodes: ['Cab-Bottom'],
      move: { dirMm: [0, -1, 0], distanceMm: 130 },
      explode: { dirMm: [0, -1, 0], distanceMm: 200 },
      defaultState: 'installed',
      states: ['installed', 'hidden', 'removed'],
      supportsTransparency: true,
    },
    {
      id: 'back-panel',
      name: 'Back Panel',
      kind: 'rear-cover',
      interaction: 'remove',
      group: 'rear',
      nodes: ['Cab-Back'],
      move: { dirMm: [0, 0, -1], distanceMm: 130 },
      explode: { dirMm: [0, 0, -1], distanceMm: 220 },
      defaultState: 'installed',
      states: ['installed', 'hidden', 'removed'],
      supportsTransparency: true,
    },
    {
      id: 'fans',
      name: 'Roof Fans',
      kind: 'accessory',
      interaction: 'visibility',
      group: 'top',
      nodes: ['Fan-*'],
      explode: { dirMm: [0, 1, 0], distanceMm: 120 },
      defaultState: 'installed',
      states: ['installed', 'hidden'],
    },
    {
      id: 'rails',
      name: 'Mounting Rails',
      kind: 'rails',
      interaction: 'visibility',
      group: 'interior',
      nodes: ['INT_Rail_*', 'INT_Bracket_*', 'INT_Fastener_*'],
      defaultState: 'installed',
      states: ['installed', 'hidden'],
    },
    {
      id: 'frame',
      name: 'Frame & Hardware',
      kind: 'frame',
      interaction: 'visibility',
      group: 'front',
      // Catch-all for the structural shell: posts, cam-locks, vents,
      // logos, screws, and the static (cabinet-side) hinge knuckles/pins.
      nodes: [
        'Cab-FrontPost-*',
        'Cab-CamLock-*',
        'Cab-FrontVent-*',
        'Cab-Logo-*',
        'TopMountHole_*',
        'scr-*',
        'Hinge-*',
      ],
      defaultState: 'installed',
      states: ['installed', 'hidden'],
    },
  ],
};

const CABINET_MODELS: Record<string, CabinetModelDef> = {
  [UACC_WALL_12U.id]: UACC_WALL_12U,
};

/** Maps a rack profile to its interactive cabinet model, when it has one. */
const CABINET_FOR_PROFILE: Partial<Record<RackProfileId, string>> = {
  'uacc-wall-12u': UACC_WALL_12U.id,
};

export const getCabinetModel = (id: string): CabinetModelDef | undefined =>
  CABINET_MODELS[id];

/** The cabinet model a rack profile renders, or undefined for open frames. */
export function cabinetModelForProfile(
  profileId: RackProfileId,
): CabinetModelDef | undefined {
  const id = CABINET_FOR_PROFILE[profileId];
  return id ? CABINET_MODELS[id] : undefined;
}

export const ALL_CABINET_MODELS: CabinetModelDef[] = Object.values(CABINET_MODELS);
