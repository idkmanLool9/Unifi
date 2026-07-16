import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { InfoRow } from '../InfoRow';
import {
  poeBudgetW,
  portSummary,
  resolveLeds,
  type PhysicalConnectorType,
} from '@/features/devices/hardware/physicalPorts';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

const TYPE_LABELS: Partial<Record<PhysicalConnectorType, string>> = {
  rj45: 'RJ45',
  keystone: 'Keystone',
  sfp: 'SFP',
  'sfp+': 'SFP+',
  sfp28: 'SFP28',
  'qsfp+': 'QSFP+',
  qsfp28: 'QSFP28',
  usb: 'USB',
  'usb-a': 'USB-A',
  'usb-c': 'USB-C',
  console: 'Console',
  serial: 'Serial',
  power: 'Power',
  dc: 'DC',
  c14: 'IEC C14',
  c20: 'IEC C20',
};

const AIRFLOW_LABELS: Record<string, string> = {
  'front-to-rear': 'Front → rear',
  'rear-to-front': 'Rear → front',
  'side-to-side': 'Side to side',
  passive: 'Passive',
};

/**
 * Read-only hardware summary derived from the physical hardware model —
 * the same resolved data future cable routing, power planning and
 * reports consume. No editing controls.
 */
export function HardwareSection({ definition }: { definition: DeviceDefinition }) {
  const summary = portSummary(definition);
  const totalPorts = summary.reduce((sum, s) => sum + s.count, 0);
  const budget = poeBudgetW(definition);
  const leds = resolveLeds(definition);
  const power = definition.power;
  const cooling = definition.cooling;
  const display = definition.display;

  const hasAnything =
    totalPorts > 0 || power || cooling || display?.lcd || leds.length > 0;
  if (!hasAnything) return null;

  const psuCount = power?.psuCount ?? power?.connectors.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <CollapsibleSection title="Hardware">
      {totalPorts > 0 && (
        <>
          <InfoRow label="Ports">{totalPorts}</InfoRow>
          <InfoRow label="Connectors">
            {summary
              .map((s) => `${s.count}× ${TYPE_LABELS[s.type] ?? s.type}`)
              .join(' · ')}
          </InfoRow>
        </>
      )}
      {budget !== null && <InfoRow label="PoE budget">{budget} W</InfoRow>}
      {power && psuCount > 0 && (
        <InfoRow label="Power supplies">
          {psuCount}
          {power.redundant ? ' · redundant' : ''}
          {power.hotSwappable ? ' · hot-swap' : ''}
        </InfoRow>
      )}
      {cooling?.fanCount !== undefined && cooling.fanCount > 0 && (
        <InfoRow label="Cooling">
          {cooling.fanCount}× fan
          {cooling.fanDiameterMm ? ` (${cooling.fanDiameterMm} mm)` : ''}
          {cooling.airflow ? ` · ${AIRFLOW_LABELS[cooling.airflow]}` : ''}
        </InfoRow>
      )}
      {display?.lcd && (
        <InfoRow label="Display">
          LCD
          {display.resolution
            ? ` · ${display.resolution[0]}×${display.resolution[1]}`
            : ''}
          {display.touchscreen ? ' · touch' : ''}
        </InfoRow>
      )}
      {leds.length > 0 && <InfoRow label="LEDs">{leds.length}</InfoRow>}
    </CollapsibleSection>
  );
}
