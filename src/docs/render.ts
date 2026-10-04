// ST-007 (S-07, component C8): Scalar and Swagger UI HTML templates. The spec
// URL is JSON-encoded and HTML-escaped before being embedded (defence against
// a specUrl carrying `</script>"'&<`).
import { SCALAR_CDN_URL, SWAGGER_UI_CSS_CDN_URL, SWAGGER_UI_JS_CDN_URL } from './cdn.js';

export type DocsUi = 'scalar' | 'swagger-ui';

export interface RenderDocsOptions {
  readonly specUrl: string;
  readonly ui: DocsUi;
  readonly cdnUrl?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML-escapes `specUrl` for use inside a double-quoted attribute value (data-url="..."). */
function encodeSpecUrlAttr(specUrl: string): string {
  return escapeHtml(specUrl);
}

/** JSON-encodes `specUrl` as a JS string literal for a <script> block; `<` is escaped so `</script>` cannot close the tag. */
function encodeSpecUrlScript(specUrl: string): string {
  return JSON.stringify(specUrl).replace(/</g, '\\u003c');
}

function renderScalarHtml(specUrl: string, cdnUrl: string | undefined): string {
  const scriptUrl = escapeHtml(cdnUrl ?? SCALAR_CDN_URL);
  const encodedUrl = encodeSpecUrlAttr(specUrl);
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8"><title>API Docs</title></head>',
    '<body>',
    `<script id="api-reference" data-url="${encodedUrl}"></script>`,
    `<script src="${scriptUrl}"></script>`,
    '</body>',
    '</html>',
  ].join('\n');
}

function renderSwaggerHtml(specUrl: string, cdnUrl: string | undefined): string {
  const jsUrl = escapeHtml(cdnUrl ?? SWAGGER_UI_JS_CDN_URL);
  const cssUrl = escapeHtml(SWAGGER_UI_CSS_CDN_URL);
  const encodedUrl = encodeSpecUrlScript(specUrl);
  return [
    '<!doctype html>',
    '<html>',
    `<head><meta charset="utf-8"><title>API Docs</title><link rel="stylesheet" href="${cssUrl}"></head>`,
    '<body>',
    '<div id="swagger-ui"></div>',
    `<script src="${jsUrl}"></script>`,
    '<script>',
    `window.onload = function () { window.ui = SwaggerUIBundle({ url: ${encodedUrl}, dom_id: '#swagger-ui' }); };`,
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** Renders the docs HTML for `options.ui`, embedding `options.specUrl` safely (AC-018, AC-019, AC-037). */
export function renderDocsHtml(options: RenderDocsOptions): string {
  if (options.ui === 'swagger-ui') {
    return renderSwaggerHtml(options.specUrl, options.cdnUrl);
  }
  return renderScalarHtml(options.specUrl, options.cdnUrl);
}
