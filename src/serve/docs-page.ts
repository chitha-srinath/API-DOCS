// Serves the built-in API docs UI (the shadcn app in examples/docs-ui, embedded at
// build time by scripts/build-docs-ui.mjs). The page is fixed: the only values that
// reach the markup are the configured docs and spec paths, JSON-encoded for the
// script and escaped so configuration cannot inject markup.
import { DOCS_UI_FILES, DOCS_UI_INDEX_HTML } from './docs-ui.generated.js';

export interface DocsAsset {
  type: string;
  body: string | Buffer;
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** The UI page, with asset URLs and the spec path rewritten for this mount. */
export function renderDocsPage(docsPath: string, specPath: string): string {
  const base = trimTrailingSlash(docsPath);
  const config = `<script>window.__API_DOCS__ = ${scriptJson({ specPath })};</script>`;
  return DOCS_UI_INDEX_HTML.replaceAll('/assets/', `${base}/assets/`).replace('</head>', `${config}</head>`);
}

/** A built asset by file name, or undefined. Only plain names in the asset folder resolve. */
export function getDocsAsset(docsPath: string, name: string): DocsAsset | undefined {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return undefined;
  const file = DOCS_UI_FILES[name];
  if (!file) return undefined;
  if (file.encoding === 'base64') {
    return { type: file.type, body: Buffer.from(file.data, 'base64') };
  }
  // CSS references fonts by absolute /assets/ URLs, so rewrite them to this mount.
  const base = trimTrailingSlash(docsPath);
  return { type: file.type, body: file.data.replaceAll('/assets/', `${base}/assets/`) };
}
