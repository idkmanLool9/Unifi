import { useEffect, useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FlipHorizontal2,
  MousePointer2,
  Trash2,
} from 'lucide-react';
import { DeviceModel, ModelErrorBoundary } from './DeviceModel';
import { DevicePlaceholder } from './DevicePlaceholder';
import { getDevice, useRegistryStore } from './deviceRegistry';
import { RackSelection } from '@/features/rack/RackSelection';
import { devicePlacement, MM_TO_M } from '@/features/rack/rackMath';
import { VIEWPORT_THEME } from '@/features/viewport/viewportTheme';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useMenuStore } from '@/stores/menuStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { toast } from '@/stores/toastStore';
import type { PlacedDevice } from '@/features/rack/rackMath';
import type { ResolvedTheme } from '@/types';

function openDeviceMenu(x: number, y: number, instance: PlacedDevice) {
  const { moveDevice, setFacing, setVisible, removeDevice } =
    useDeviceInstancesStore.getState();
  const definition = getDevice(instance.definitionId);
  const name = definition?.productName ?? 'Device';

  const tryMove = (delta: number) => {
    const result = moveDevice(instance.id, instance.startU + delta);
    if (!result.ok) {
      toast({ variant: 'warning', title: 'Can’t move device', description: result.message });
    }
  };

  useMenuStore.getState().openMenu(x, y, [
    {
      id: 'inspect',
      label: `Inspect ${name}`,
      icon: MousePointer2,
      action: () => useSelectionStore.getState().selectDevice(instance.id),
    },
    { separator: true },
    {
      id: 'move-up',
      label: 'Move up 1U',
      icon: ArrowUp,
      action: () => tryMove(1),
    },
    {
      id: 'move-down',
      label: 'Move down 1U',
      icon: ArrowDown,
      action: () => tryMove(-1),
    },
    {
      id: 'facing',
      label:
        instance.facing === 'front' ? 'Mount rear-facing' : 'Mount front-facing',
      icon: FlipHorizontal2,
      action: () =>
        setFacing(instance.id, instance.facing === 'front' ? 'rear' : 'front'),
    },
    {
      id: 'visibility',
      label: instance.visible ? 'Hide device' : 'Show device',
      icon: instance.visible ? EyeOff : Eye,
      action: () => setVisible(instance.id, !instance.visible),
    },
    { separator: true },
    {
      id: 'remove',
      label: 'Remove from rack',
      icon: Trash2,
      danger: true,
      action: () => {
        removeDevice(instance.id);
        toast({ variant: 'success', title: `${name} removed` });
      },
    },
  ]);
}

function MountedDeviceView({
  instance,
  theme,
}: {
  instance: PlacedDevice;
  theme: ResolvedTheme;
}) {
  const [hovered, setHovered] = useState(false);
  const selected = useSelectionStore(
    (s) =>
      s.selection?.kind === 'device' &&
      s.selection.instanceId === instance.id,
  );
  const selectDevice = useSelectionStore((s) => s.selectDevice);

  const definition = getDevice(instance.definitionId);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  if (!definition || !instance.visible) return null;

  const { position, rotationY } = devicePlacement(
    definition,
    instance.startU,
    instance.facing,
  );
  const w = definition.widthMm * MM_TO_M;
  const h = definition.heightMm * MM_TO_M;
  const d = definition.depthMm * MM_TO_M;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectDevice(instance.id);
  };

  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Keep the viewport's own context menu from opening on top.
    e.nativeEvent.preventDefault();
    e.nativeEvent.stopPropagation();
    openDeviceMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, instance);
  };

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Nothing a single device does may blank the scene. */}
      <ModelErrorBoundary
        key={`${instance.id}-${instance.definitionId}`}
        label={`device ${definition.productName}`}
        fallback={<DevicePlaceholder definition={definition} />}
      >
        <DeviceModel definition={definition} />
      </ModelErrorBoundary>
      {(selected || hovered) && (
        <group position={[0, -h / 2, 0]}>
          <RackSelection
            variant="device"
            width={w}
            height={h}
            depth={d}
            accent={VIEWPORT_THEME[theme].accent}
            selected={selected}
          />
        </group>
      )}
    </group>
  );
}

/**
 * All devices mounted in the rack. Rendered inside the rack's animated
 * group, so devices inherit its entrance and front/rear orientation.
 */
export function MountedDevices({ theme }: { theme: ResolvedTheme }) {
  const instances = useDeviceInstancesStore((s) => s.instances);
  // Re-render when external definitions finish loading.
  useRegistryStore((s) => s.version);

  return (
    <>
      {instances.map((instance) => (
        <MountedDeviceView
          key={instance.id}
          instance={instance}
          theme={theme}
        />
      ))}
    </>
  );
}
