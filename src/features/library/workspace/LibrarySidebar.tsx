import { useState } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderPlus,
  Layers,
  Plus,
  Star,
} from 'lucide-react';
import { useLibraryEntries } from './useLibraryEntries';
import { classifyDevice, CATEGORY_TREE, type CategoryNode } from './categoryTree';
import { manufacturerInfo } from './manufacturers';
import { useLibraryMetaStore } from './libraryMetaStore';
import {
  useLibraryWorkspaceStore,
  type LibraryScope,
} from './libraryWorkspaceStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMenuStore } from '@/stores/menuStore';
import { cn } from '@/lib/utils';

/**
 * Library navigation: quick scopes, the nested category tree (built-in
 * + user categories), manufacturer collections with accent identities,
 * and user collections that accept device drops.
 */

const scopeEquals = (a: LibraryScope, b: LibraryScope): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

function NavRow({
  active,
  onClick,
  onContextMenu,
  onDragOver,
  onDrop,
  depth = 0,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  depth?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors',
        active
          ? 'bg-accent/12 font-medium text-accent'
          : 'text-secondary hover:bg-raised hover:text-primary',
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {children}
      </span>
      {action}
    </div>
  );
}

export function LibrarySidebar() {
  const entries = useLibraryEntries();
  const scope = useLibraryWorkspaceStore((s) => s.scope);
  const setScope = useLibraryWorkspaceStore((s) => s.setScope);
  const favoriteIds = useLibraryStore((s) => s.favoriteIds);
  const recentIds = useLibraryStore((s) => s.recentIds);
  const customCategories = useLibraryMetaStore((s) => s.customCategories);
  const collections = useLibraryMetaStore((s) => s.collections);
  const addCollection = useLibraryMetaStore((s) => s.addCollection);
  const addCategory = useLibraryMetaStore((s) => s.addCategory);
  const addToCollection = useLibraryMetaStore((s) => s.addToCollection);
  const renameCollection = useLibraryMetaStore((s) => s.renameCollection);
  const removeCollection = useLibraryMetaStore((s) => s.removeCollection);
  const removeCategory = useLibraryMetaStore((s) => s.removeCategory);
  const openMenu = useMenuStore((s) => s.openMenu);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Per-node device counts (visible entries only).
  const visible = entries.filter((e) => !e.meta.hidden);
  const countFor = (nodeId: string): number =>
    visible.filter(
      (e) =>
        classifyDevice(e.definition).includes(nodeId) ||
        e.meta.customCategoryId === nodeId,
    ).length;

  const manufacturers = [...new Set(visible.map((e) => e.definition.manufacturer))]
    .map((id) => {
      const first = visible.find((e) => e.definition.manufacturer === id)!;
      return {
        info: manufacturerInfo(id, first.definition.manufacturerName),
        count: visible.filter((e) => e.definition.manufacturer === id).length,
      };
    })
    .sort((a, b) => b.count - a.count);

  const select = (next: LibraryScope) => setScope(next);
  const toggleCollapse = (id: string) =>
    setCollapsed((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id],
    );

  const renderNode = (node: CategoryNode, depth: number) => {
    const active = scopeEquals(scope, { kind: 'category', nodeId: node.id });
    const isCollapsed = collapsed.includes(node.id);
    const count = countFor(node.id);
    return (
      <div key={node.id}>
        <NavRow
          active={active}
          depth={depth}
          onClick={() => select({ kind: 'category', nodeId: node.id })}
          onContextMenu={
            node.custom
              ? (e) => {
                  e.preventDefault();
                  openMenu(e.clientX, e.clientY, [
                    {
                      id: 'delete',
                      label: 'Delete category',
                      danger: true,
                      action: () => removeCategory(node.id),
                    },
                  ]);
                }
              : undefined
          }
        >
          {node.children ? (
            <span
              role="button"
              tabIndex={-1}
              className="-ml-1 rounded p-0.5 hover:bg-raised"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.id);
              }}
              onKeyDown={() => {}}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </span>
          ) : (
            <span className="w-2.5" />
          )}
          <span className="min-w-0 flex-1 truncate">{node.label}</span>
          {count > 0 && <span className="text-[10px] text-muted">{count}</span>}
        </NavRow>
        {node.children && !isCollapsed && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex w-[236px] shrink-0 flex-col overflow-y-auto border-r border-edge bg-surface px-2 pb-4">
      <SectionTitle>Library</SectionTitle>
      <NavRow
        active={scope.kind === 'all'}
        onClick={() => select({ kind: 'all' })}
      >
        <Layers className="size-3.5" strokeWidth={1.75} />
        <span className="flex-1">All devices</span>
        <span className="text-[10px] text-muted">{visible.length}</span>
      </NavRow>
      <NavRow
        active={scope.kind === 'favorites'}
        onClick={() => select({ kind: 'favorites' })}
      >
        <Star className="size-3.5" strokeWidth={1.75} />
        <span className="flex-1">Favorites</span>
        <span className="text-[10px] text-muted">{favoriteIds.length}</span>
      </NavRow>
      <NavRow
        active={scope.kind === 'recent'}
        onClick={() => select({ kind: 'recent' })}
      >
        <Clock className="size-3.5" strokeWidth={1.75} />
        <span className="flex-1">Recent</span>
        <span className="text-[10px] text-muted">{recentIds.length}</span>
      </NavRow>

      <SectionTitle
        action={
          <button
            type="button"
            title="New custom category"
            aria-label="New custom category"
            onClick={() => {
              const name = window.prompt('Category name');
              if (name?.trim()) addCategory(name.trim());
            }}
            className="rounded p-0.5 text-muted transition-colors hover:bg-raised hover:text-primary"
          >
            <Plus className="size-3" />
          </button>
        }
      >
        Categories
      </SectionTitle>
      {CATEGORY_TREE.map((node) => renderNode(node, 0))}
      {customCategories.map((c) =>
        renderNode({ id: c.id, label: c.name, custom: true }, 0),
      )}

      <SectionTitle>Manufacturers</SectionTitle>
      {manufacturers.map(({ info, count }) => (
        <NavRow
          key={info.id}
          active={scopeEquals(scope, { kind: 'manufacturer', id: info.id })}
          onClick={() => select({ kind: 'manufacturer', id: info.id })}
        >
          <span
            className="flex size-4 items-center justify-center rounded text-[8.5px] font-bold"
            style={{ backgroundColor: `${info.accent}26`, color: info.accent }}
          >
            {info.monogram}
          </span>
          <span className="min-w-0 flex-1 truncate">{info.name}</span>
          <span className="text-[10px] text-muted">{count}</span>
        </NavRow>
      ))}

      <SectionTitle
        action={
          <button
            type="button"
            title="New collection"
            aria-label="New collection"
            onClick={() => {
              const created = addCollection();
              setRenaming(created.id);
              setRenameText(created.name);
            }}
            className="rounded p-0.5 text-muted transition-colors hover:bg-raised hover:text-primary"
          >
            <FolderPlus className="size-3" />
          </button>
        }
      >
        Collections
      </SectionTitle>
      {collections.length === 0 && (
        <p className="px-2 py-1 text-[10.5px] leading-snug text-muted">
          Create collections and drag devices onto them — Home Lab,
          Customer A, Project Alpha…
        </p>
      )}
      {collections.map((collection) =>
        renaming === collection.id ? (
          <input
            key={collection.id}
            autoFocus
            onFocus={(e) => e.target.select()}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onBlur={() => {
              if (renameText.trim()) {
                renameCollection(collection.id, renameText.trim());
              }
              setRenaming(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(null);
            }}
            className="mx-1 my-0.5 h-7 rounded-lg border border-accent bg-surface-raised px-2 text-xs text-primary focus:outline-none"
          />
        ) : (
          <NavRow
            key={collection.id}
            active={scopeEquals(scope, { kind: 'collection', id: collection.id })}
            onClick={() => select({ kind: 'collection', id: collection.id })}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY, [
                {
                  id: 'rename',
                  label: 'Rename',
                  action: () => {
                    setRenaming(collection.id);
                    setRenameText(collection.name);
                  },
                },
                {
                  id: 'delete',
                  label: 'Delete collection',
                  danger: true,
                  action: () => removeCollection(collection.id),
                },
              ]);
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('rackforge/device-id')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('rackforge/device-id');
              if (id) {
                e.preventDefault();
                addToCollection(collection.id, id);
              }
            }}
          >
            <Boxes className="size-3.5" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{collection.name}</span>
            <span className="text-[10px] text-muted">
              {collection.deviceIds.length}
            </span>
          </NavRow>
        ),
      )}
    </aside>
  );
}
