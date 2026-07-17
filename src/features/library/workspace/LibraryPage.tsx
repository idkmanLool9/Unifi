import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Import, Library } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { ContextMenuHost } from '@/components/ui/ContextMenuHost';
import { ToastHost } from '@/components/ui/ToastHost';
import { LibrarySidebar } from './LibrarySidebar';
import { LibraryFilterBar } from './LibraryFilterBar';
import { LibraryGrid } from './LibraryGrid';
import { LibraryPreviewPanel } from './LibraryPreviewPanel';
import { ImportDeviceDialog } from './ImportDeviceDialog';
import { queryEntries, sortEntries } from './libraryIndex';
import { useLibraryEntries } from './useLibraryEntries';
import { useLibraryMetaStore } from './libraryMetaStore';
import { useLibraryWorkspaceStore } from './libraryWorkspaceStore';
import { useLibraryStore } from '@/stores/libraryStore';

/**
 * The Device Library workspace — RackForge's asset browser. One page
 * owns discovery (search, filters, categories, manufacturers,
 * collections), management (favorites, pins, metadata, versioning) and
 * intake (import → authoring). The compiled entry index keeps every
 * interaction instant regardless of library size.
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const entries = useLibraryEntries();
  const scope = useLibraryWorkspaceStore((s) => s.scope);
  const query = useLibraryWorkspaceStore((s) => s.query);
  const setQuery = useLibraryWorkspaceStore((s) => s.setQuery);
  const filters = useLibraryWorkspaceStore((s) => s.filters);
  const sort = useLibraryWorkspaceStore((s) => s.sort);
  const selectedId = useLibraryWorkspaceStore((s) => s.selectedId);
  const favoriteIds = useLibraryStore((s) => s.favoriteIds);
  const recentIds = useLibraryStore((s) => s.recentIds);
  const pinnedIds = useLibraryMetaStore((s) => s.pinnedIds);
  const collections = useLibraryMetaStore((s) => s.collections);
  const [importOpen, setImportOpen] = useState(false);

  const results = useMemo(() => {
    let scoped = entries;
    switch (scope.kind) {
      case 'favorites':
        scoped = scoped.filter((e) => favoriteIds.includes(e.id));
        break;
      case 'recent': {
        const quick = [...pinnedIds, ...recentIds.filter((r) => !pinnedIds.includes(r))];
        scoped = scoped.filter((e) => quick.includes(e.id));
        break;
      }
      case 'collection': {
        const collection = collections.find((c) => c.id === scope.id);
        scoped = scoped.filter((e) => collection?.deviceIds.includes(e.id));
        break;
      }
      case 'manufacturer':
        scoped = scoped.filter((e) => e.definition.manufacturer === scope.id);
        break;
      default:
        break;
    }
    const filtered = queryEntries(scoped, {
      text: query,
      filters,
      categoryNode: scope.kind === 'category' ? scope.nodeId : null,
    });
    if (scope.kind === 'recent') {
      // Quick-access order: pins first, then recency.
      const order = [...pinnedIds, ...recentIds.filter((r) => !pinnedIds.includes(r))];
      return [...filtered].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return sortEntries(filtered, sort, recentIds);
  }, [entries, scope, query, filters, sort, favoriteIds, recentIds, pinnedIds, collections]);

  const selected = selectedId
    ? entries.find((e) => e.id === selectedId)
    : undefined;

  return (
    <div className="flex h-dvh flex-col bg-canvas text-primary">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-edge bg-surface px-3">
        <button
          type="button"
          onClick={() => void navigate('/')}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-secondary transition-colors hover:bg-raised hover:text-primary"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          Editor
        </button>
        <div className="flex items-center gap-2">
          <Library className="size-4 text-accent" strokeWidth={1.75} />
          <span className="text-sm font-semibold">Device Library</span>
        </div>
        <div className="mx-auto w-full max-w-md">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices, manufacturers, ports, tags…"
            aria-label="Search the device library"
          />
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Import className="size-3.5" strokeWidth={1.75} />
          Import
        </button>
      </header>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        <LibrarySidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <LibraryFilterBar resultCount={results.length} />
          <LibraryGrid
            entries={results}
            onOpenAuthoring={(id) => void navigate(`/author?device=${id}`)}
          />
        </main>
        {selected && <LibraryPreviewPanel key={selected.id} entry={selected} />}
      </div>

      <ImportDeviceDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ContextMenuHost />
      <ToastHost />
    </div>
  );
}
