// Renders the built-in API docs UI page. The page is a fixed template: the only
// value interpolated is the spec path, which is JSON-encoded for the script and
// HTML-escaped for the attribute context, so configuration cannot inject markup.
const SWAGGER_VERSION = '5';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDocsPage(specPath: string): string {
  const specJson = JSON.stringify(specPath).replace(/</g, '\\u003c');
  const title = escapeHtml('API Docs');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css" />
  </head>
  <body>
    <div id="api-docs"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: ${specJson}, dom_id: '#api-docs' });
    </script>
  </body>
</html>`;
}
