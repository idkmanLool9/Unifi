/**
 * Resolves an app-root-relative path against Vite's BASE_URL, so runtime
 * asset requests (device metadata, GLB models, thumbnails) work both at
 * the domain root and under a subpath deployment such as GitHub Pages
 * (https://<user>.github.io/<repo>/).
 *
 * BASE_URL always ends with '/'; leading slashes on `path` are stripped
 * so the result never escapes the base.
 */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
