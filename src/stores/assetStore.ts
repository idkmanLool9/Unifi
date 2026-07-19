import { create } from 'zustand';

export type AssetAvailability = 'checking' | 'available' | 'missing';

interface AssetState {
  availability: Record<string, AssetAvailability>;
  /** Probes a URL once; subsequent calls are no-ops. */
  probe: (url: string) => void;
}

/**
 * Availability cache for optional binary assets (GLB models, thumbnails).
 * A HEAD probe runs once per URL; SPA fallbacks (index.html served for a
 * missing file) are treated as missing via content-type inspection.
 */
export const useAssetStore = create<AssetState>()((set, get) => ({
  availability: {},

  probe: (url) => {
    if (!url || get().availability[url] !== undefined) return;
    // Object/data URLs exist by construction — and blob: rejects HEAD.
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      set((s) => ({ availability: { ...s.availability, [url]: 'available' } }));
      return;
    }
    set((s) => ({ availability: { ...s.availability, [url]: 'checking' } }));

    void fetch(url, { method: 'HEAD' })
      .then((res) => {
        const type = res.headers.get('content-type') ?? '';
        const isRealAsset = res.ok && !type.includes('text/html');
        set((s) => ({
          availability: {
            ...s.availability,
            [url]: isRealAsset ? 'available' : 'missing',
          },
        }));
      })
      .catch(() =>
        set((s) => ({
          availability: { ...s.availability, [url]: 'missing' },
        })),
      );
  },
}));

/** React hook: current availability of a URL, probing on first use. */
export function useAssetAvailability(url: string): AssetAvailability {
  const status = useAssetStore((s) => s.availability[url]);
  if (!url) return 'missing';
  if (status === undefined) {
    useAssetStore.getState().probe(url);
    return 'checking';
  }
  return status;
}
