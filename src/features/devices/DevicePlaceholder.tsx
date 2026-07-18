import { ParametricChassis } from './parametric/ParametricChassis';
import type { DeviceDefinition } from './deviceSchema';

/**
 * The device shown until (or instead of) a real GLB: the Parametric
 * Device Generator builds professional placeholder hardware from the
 * definition's metadata alone — chassis, ears, vents, bays, badges —
 * with automatic LOD. Swapping in a custom GLB later changes nothing
 * about the metadata; this component simply stops rendering.
 */
export function DevicePlaceholder({
  definition,
}: {
  definition: DeviceDefinition;
}) {
  return <ParametricChassis definition={definition} />;
}
