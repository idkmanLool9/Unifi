import { useEffect, useRef, useState } from 'react';
import { Group } from 'three';
import { type ThreeEvent } from '@react-three/fiber';
import { DEBUG_BOUNDS_ENABLED, DebugBounds } from './DebugBounds';
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
import { MountingHardware } from './MountingHardware';
import { getDevice, useRegistryStore } from './deviceRegistry';
import { armDrag } from '@/features/dragdrop/DragController';
import { focusDevice } from '@/features/viewport/focusActions';
import { requestRemoveDevice } from './removeDeviceAction';
import { shouldSuppressClick } from '@/stores/dragStore';
import { RackSelection } from '@/features/rack/RackSelection';
import {
  devicePlacement,
  MM_TO_M,
  type RackGeometry,
} from '@/features/rack/rackMath';
import { VIEWPORT_THEME } from '@/features/viewport/viewportTheme';
import { useDeviceInstancesStore } from '@/stores/deviceInstancesStore';
import { useMenuStore } from '@/stores/menuStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { toast } from '@/stores/toastStore';
import type { PlacedDevice } from '@/features/rack/rackMath';
import type { ResolvedTheme } from '@/types';

function openDeviceMenu(x: number, y: number, instance: PlacedDevice) {
  const { moveDevice, setFacing, setVisible } =
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
      // Cable-aware: confirms when the device has attached cables.
      action: () => requestRemoveDevice(instance.id),
    },
  ]);
}

function MountedDeviceView({
  instance,
  theme,
  geometry,
}: {
  instance: PlacedDevice;
  theme: ResolvedTheme;
  geometry: RackGeometry;
}) {
  const [hovered, setHovered] = useState(false);
  const modelRef = useRef<Group>(null);
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
    geometry,
  );
  const w = definition.widthMm * MM_TO_M;
  const h = definition.heightMm * MM_TO_M;
  const d = definition.depthMm * MM_TO_M;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (shouldSuppressClick()) return;
    selectDevice(instance.id);
  };

  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Focus the clicked panel: double-clicking the front frames the
    // faceplate, double-clicking the rear frames the rear ports.
    selectDevice(instance.id);
    const local = modelRef.current?.worldToLocal(e.point.clone());
    focusDevice(instance.id, false, local && local.z < 0 ? 'rear' : 'front');
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    // Direct manipulation: drag the device to another U (Alt duplicates).
    // Transactional — the original stays until a valid drop commits.
    const duplicate = e.nativeEvent.altKey;
    armDrag(
      e.nativeEvent,
      () => {
        selectDevice(instance.id);
        return {
          kind: 'instance',
          instanceId: instance.id,
          definitionId: instance.definitionId,
          duplicate,
        };
      },
      { suspendOrbit: true },
    );
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
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Nothing a single device does may blank the scene. */}
      <group ref={modelRef}>
        <ModelErrorBoundary
          key={`${instance.id}-${instance.definitionId}`}
          label={`device ${definition.productName}`}
          fallback={<DevicePlaceholder definition={definition} />}
        >
          <DeviceModel definition={definition} instanceId={instance.id} />
        </ModelErrorBoundary>
      </group>
      {/* Parametric mounting hardware (outside the measured model group) */}
      <MountingHardware definition={definition} geometry={geometry} />
      {DEBUG_BOUNDS_ENABLED && (
        <DebugBounds
          target={modelRef}
          expectedMm={[definition.widthMm, definition.heightMm, definition.depthMm]}
          label={`${definition.productName} @ U${instance.startU}`}
          definitionId={definition.id}
        />
      )}
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
export function MountedDevices({
  theme,
  geometry,
}: {
  theme: ResolvedTheme;
  geometry: RackGeometry;
}) {
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
          geometry={geometry}
        />
      ))}
    </>
  );
}
