import { useMemo } from 'react';
import { useAuthoringStore } from './authoringStore';
import {
  issueCounts,
  validateAuthoring,
  type ValidationIssue,
} from './validation';
import { getDevice } from '@/features/devices/deviceRegistry';

/**
 * Live validation over the authored state. Recomputes only when the
 * authored data actually changes; every consumer (status bar, category
 * badge, validation panel) shares the same memoized result shape.
 */
export function useValidation(): {
  issues: ValidationIssue[];
  counts: { errors: number; warnings: number; infos: number };
} {
  const deviceId = useAuthoringStore((s) => s.deviceId);
  const ports = useAuthoringStore((s) => s.ports);
  const leds = useAuthoringStore((s) => s.leds);
  const display = useAuthoringStore((s) => s.display);
  const cooling = useAuthoringStore((s) => s.cooling);
  const mountOffsetMm = useAuthoringStore((s) => s.mountOffsetMm);

  return useMemo(() => {
    const definition = deviceId ? getDevice(deviceId) : undefined;
    if (!definition) {
      return { issues: [], counts: { errors: 0, warnings: 0, infos: 0 } };
    }
    const issues = validateAuthoring({
      definition,
      ports,
      leds,
      display,
      cooling,
      mountOffsetMm,
    });
    return { issues, counts: issueCounts(issues) };
  }, [deviceId, ports, leds, display, cooling, mountOffsetMm]);
}
