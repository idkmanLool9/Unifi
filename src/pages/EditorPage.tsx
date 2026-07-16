import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { InspectorPanel } from '@/features/inspector/InspectorPanel';
import { ViewportCanvas } from '@/features/viewport/ViewportCanvas';
import { DevicePreviewPanel } from '@/features/library/DevicePreviewPanel';
import { DragController } from '@/features/dragdrop/DragController';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';

/** The rack editor: library panel, 3D viewport, and inspector. */
export function EditorPage() {
  useEditorShortcuts();

  return (
    <div className="flex min-w-0 flex-1">
      <LeftSidebar />
      <div className="relative flex min-w-0 flex-1">
        <ViewportCanvas />
        {/* Floating device preview, anchored to the viewport's left edge */}
        <DevicePreviewPanel />
      </div>
      <InspectorPanel />
      {/* Drag & drop gesture owner + HTML drag chip */}
      <DragController />
    </div>
  );
}
