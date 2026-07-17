import type {
  AuthoredLed,
  AuthoredPort,
  Vec3,
} from './authoringModel';
import type {
  CoolingCapabilities,
  DeviceDefinition,
  DisplayCapabilities,
} from '@/features/devices/deviceSchema';

/**
 * Real-time authoring validation. Pure and fast: runs on every edit
 * over the full authored state, producing typed issues the workspace
 * surfaces live (status bar count, Validation category, inspector
 * badges). No side effects, no three.js.
 */

export type IssueLevel = 'error' | 'warning' | 'info';

export interface ValidationTarget {
  kind: 'port' | 'led' | 'display' | 'fan' | 'device';
  id: string;
}

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  target: ValidationTarget;
}

export interface AuthoringSnapshot {
  definition: Pick<DeviceDefinition, 'widthMm' | 'heightMm' | 'depthMm'>;
  ports: readonly AuthoredPort[];
  leds: readonly AuthoredLed[];
  display?: DisplayCapabilities;
  cooling?: CoolingCapabilities;
  mountOffsetMm: Vec3;
}

const finite = (values: readonly number[]): boolean =>
  values.every((v) => Number.isFinite(v));

/** How far outside the chassis a connector may sit before we warn, mm. */
const BOUNDS_SLACK_MM = 2;
/** Depth slack: recessed/proud faces are normal within this range, mm. */
const DEPTH_SLACK_MM = 30;
/** Authored opening sizes are interaction hitboxes, intentionally
 *  oversized — adjacent jacks may graze by this much before we warn, mm. */
const OVERLAP_SLACK_MM = 2;

function outsideChassis(
  positionMm: Vec3,
  halfSize: [number, number],
  dims: AuthoringSnapshot['definition'],
): boolean {
  return (
    Math.abs(positionMm[0]) + halfSize[0] >
      dims.widthMm / 2 + BOUNDS_SLACK_MM ||
    Math.abs(positionMm[1]) + halfSize[1] >
      dims.heightMm / 2 + BOUNDS_SLACK_MM ||
    Math.abs(positionMm[2]) > dims.depthMm / 2 + DEPTH_SLACK_MM
  );
}

export function validateAuthoring(input: AuthoringSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { definition: dims, ports, leds } = input;
  const push = (
    level: IssueLevel,
    code: string,
    message: string,
    target: ValidationTarget,
  ) => issues.push({ level, code, message, target });

  /* ---- ports ---------------------------------------------------------- */

  const seenIds = new Map<string, number>();
  for (const port of ports) {
    seenIds.set(port.id, (seenIds.get(port.id) ?? 0) + 1);
  }
  for (const [id, count] of seenIds) {
    if (count > 1) {
      push('error', 'duplicate-port-id', `Port id "${id}" is used ${count} times`, {
        kind: 'port',
        id,
      });
    }
  }

  for (const port of ports) {
    const numbers = [
      ...port.positionMm,
      ...port.rotationDeg,
      ...port.sizeMm,
      ...port.anchorMm,
    ];
    if (!finite(numbers)) {
      push('error', 'invalid-transform', `Port "${port.id}" has a non-finite transform`, {
        kind: 'port',
        id: port.id,
      });
      continue;
    }
    if (port.sizeMm[0] <= 0 || port.sizeMm[1] <= 0) {
      push('error', 'invalid-size', `Port "${port.id}" has a non-positive opening size`, {
        kind: 'port',
        id: port.id,
      });
    }
    if (outsideChassis(port.positionMm, [port.sizeMm[0] / 2, port.sizeMm[1] / 2], dims)) {
      push('warning', 'outside-chassis', `Port "${port.id}" sits outside the chassis bounds`, {
        kind: 'port',
        id: port.id,
      });
    }

    // Anchor sanity: the cable anchor should sit on the outward side.
    const outward = port.location === 'front' ? 1 : -1;
    if (port.anchorMm[2] * outward < 0) {
      push('warning', 'anchor-inside', `Port "${port.id}" cable anchor points into the chassis`, {
        kind: 'port',
        id: port.id,
      });
    }
    if (Math.hypot(...port.anchorMm) > 80) {
      push('warning', 'anchor-far', `Port "${port.id}" cable anchor is unusually far (${Math.round(Math.hypot(...port.anchorMm))} mm)`, {
        kind: 'port',
        id: port.id,
      });
    }

    // Exit direction sanity.
    if (port.exitDirMm) {
      const length = Math.hypot(...port.exitDirMm);
      if (length < 1e-6) {
        push('error', 'exit-zero', `Port "${port.id}" has a zero cable exit direction`, {
          kind: 'port',
          id: port.id,
        });
      } else if ((port.exitDirMm[2] / length) * outward < -0.2) {
        push('warning', 'exit-into-panel', `Port "${port.id}" cable exit points into the panel`, {
          kind: 'port',
          id: port.id,
        });
      }
    }
  }

  // Overlapping openings on the same panel face.
  const byFace = new Map<string, AuthoredPort[]>();
  for (const port of ports) {
    const key = port.location;
    (byFace.get(key) ?? byFace.set(key, []).get(key)!).push(port);
  }
  for (const face of byFace.values()) {
    const sorted = [...face].sort((a, b) => a.positionMm[0] - b.positionMm[0]);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const dx = b.positionMm[0] - a.positionMm[0];
        if (dx >= (a.sizeMm[0] + b.sizeMm[0]) / 2) break; // sorted: no more
        if (dx >= (a.sizeMm[0] + b.sizeMm[0]) / 2 - OVERLAP_SLACK_MM) continue;
        const dy = Math.abs(b.positionMm[1] - a.positionMm[1]);
        if (dy < (a.sizeMm[1] + b.sizeMm[1]) / 2 - OVERLAP_SLACK_MM) {
          push('warning', 'ports-overlap', `Ports "${a.id}" and "${b.id}" overlap`, {
            kind: 'port',
            id: a.id,
          });
        }
      }
    }
  }

  if (ports.length === 0) {
    push('info', 'no-ports', 'No ports authored yet', { kind: 'device', id: 'device' });
  }

  /* ---- LEDs ----------------------------------------------------------- */

  const ledIds = new Map<string, number>();
  for (const led of leds) ledIds.set(led.id, (ledIds.get(led.id) ?? 0) + 1);
  for (const [id, count] of ledIds) {
    if (count > 1) {
      push('error', 'duplicate-led-id', `LED id "${id}" is used ${count} times`, {
        kind: 'led',
        id,
      });
    }
  }
  for (const led of leds) {
    if (!finite(led.positionMm) || !Number.isFinite(led.diameterMm)) {
      push('error', 'invalid-led', `LED "${led.id}" has a non-finite transform`, {
        kind: 'led',
        id: led.id,
      });
      continue;
    }
    if (led.diameterMm <= 0) {
      push('error', 'invalid-led-size', `LED "${led.id}" has a non-positive diameter`, {
        kind: 'led',
        id: led.id,
      });
    }
    if (outsideChassis(led.positionMm, [led.diameterMm / 2, led.diameterMm / 2], dims)) {
      push('warning', 'led-outside', `LED "${led.id}" sits outside the chassis bounds`, {
        kind: 'led',
        id: led.id,
      });
    }
  }

  /* ---- display -------------------------------------------------------- */

  const display = input.display;
  if (display?.lcd) {
    const w = display.widthMm ?? 60;
    const h = display.heightMm ?? 25;
    const pos = (display.positionMm ?? [0, 0, dims.depthMm / 2]) as Vec3;
    if (w <= 0 || h <= 0) {
      push('error', 'invalid-display', 'Display has a non-positive size', {
        kind: 'display',
        id: 'display',
      });
    } else if (outsideChassis(pos, [w / 2, h / 2], dims)) {
      push('warning', 'display-outside', 'Display sits outside the chassis bounds', {
        kind: 'display',
        id: 'display',
      });
    }
  }

  /* ---- cooling -------------------------------------------------------- */

  const fans = input.cooling?.fanPositionsMm ?? [];
  const fanR = (input.cooling?.fanDiameterMm ?? 40) / 2;
  fans.forEach((fan, i) => {
    if (!finite(fan)) {
      push('error', 'invalid-fan', `Fan ${i + 1} has a non-finite position`, {
        kind: 'fan',
        id: String(i),
      });
    } else if (outsideChassis(fan as Vec3, [fanR, fanR], dims)) {
      push('warning', 'fan-outside', `Fan ${i + 1} sits outside the chassis bounds`, {
        kind: 'fan',
        id: String(i),
      });
    }
  });

  /* ---- mount ---------------------------------------------------------- */

  const mount = input.mountOffsetMm;
  if (!finite(mount)) {
    push('error', 'invalid-mount', 'Mount offset has a non-finite value', {
      kind: 'device',
      id: 'device',
    });
  } else if (mount.some((v) => Math.abs(v) > 25)) {
    push('warning', 'mount-large', 'Mount offset exceeds 25 mm — double-check the model correction', {
      kind: 'device',
      id: 'device',
    });
  }

  return issues;
}

/** Counts per level, for the status bar chip. */
export function issueCounts(issues: readonly ValidationIssue[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const issue of issues) {
    if (issue.level === 'error') errors++;
    else if (issue.level === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}
