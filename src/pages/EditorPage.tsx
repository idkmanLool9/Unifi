import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { InspectorPanel } from '@/components/layout/InspectorPanel';
import { ViewportCanvas } from '@/features/viewport/ViewportCanvas';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';

/** The rack editor: library panel, 3D viewport, and inspector. */
export function EditorPage() {
  useEditorShortcuts();

  return (
    <div className="flex min-w-0 flex-1">
      <LeftSidebar />
      <ViewportCanvas />
      <InspectorPanel />
    </div>
  );
}
