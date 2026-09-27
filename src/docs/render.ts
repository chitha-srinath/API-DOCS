import type { UiKind } from '../config/types.js';
import { SCALAR_CDN_URL, SWAGGER_UI_CDN_URL } from './cdn.js';

export interface RenderInput {
  ui: UiKind;
  /** URL the UI loads the spec from. */
  specUrl: string;
  title: string;
  /** Overrides the pinned CDN URL. */
  cdnUrl: string | null;
}

/** Escape text for an HTML text node or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for embedding inside a <script> element (no `</script>` breakout). */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function page(title: string, head: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
${head}
  </head>
  <body>
${body}
  </body>
</html>
`;
}

function scalar(input: RenderInput): string {
  const src = input.cdnUrl ?? SCALAR_CDN_URL;
  return page(
    input.title,
    '',
    `    <div id="app"></div>
    <script src="${escapeHtml(src)}"></script>
    <script>
      Scalar.createApiReference('#app', { url: ${scriptJson(input.specUrl)} });
    </script>`,
  );
}

function swaggerUi(input: RenderInput): string {
  const base = (input.cdnUrl ?? SWAGGER_UI_CDN_URL).replace(/\/+$/, '');
  return page(
    input.title,
    `    <link rel="stylesheet" href="${escapeHtml(`${base}/swagger-ui.css`)}" />`,
    `    <div id="swagger-ui"></div>
    <script src="${escapeHtml(`${base}/swagger-ui-bundle.js`)}"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: ${scriptJson(input.specUrl)}, dom_id: '#swagger-ui' });
    </script>`,
  );
}

/** HTML for the docs page. Scripts load from a version-pinned CDN (or `cdnUrl`). */
export function renderDocs(input: RenderInput): string {
  return input.ui === 'swagger-ui' ? swaggerUi(input) : scalar(input);
}
