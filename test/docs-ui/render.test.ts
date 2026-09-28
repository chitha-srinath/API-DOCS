// ST-007 (S-07): AC-018, AC-019, AC-020 — Scalar/Swagger UI HTML templates,
// CDN pins, custom cdnUrl override, and specUrl escaping.
import { describe, expect, it } from 'vitest';

import {
  SCALAR_CDN_URL,
  SCALAR_VERSION,
  SWAGGER_UI_CSS_CDN_URL,
  SWAGGER_UI_JS_CDN_URL,
  SWAGGER_UI_VERSION,
} from '../../src/docs/cdn.js';
import { renderDocsHtml } from '../../src/docs/render.js';

describe('docs UI renderers', () => {
  it('default ui is scalar with pinned url', () => {
    const html = renderDocsHtml({ specUrl: '/openapi.json', ui: 'scalar' });
    expect(html).toContain('@scalar/api-reference@1.72.1');
    expect(html).toContain('/openapi.json');
  });

  it('swagger-ui loads with pin', () => {
    const html = renderDocsHtml({ specUrl: '/openapi.json', ui: 'swagger-ui' });
    expect(html).toContain('swagger-ui-dist@5.33.0/swagger-ui-bundle.js');
    expect(html).toContain('swagger-ui-dist@5.33.0/swagger-ui.css');
  });

  it('custom cdnUrl is used', () => {
    const custom = 'https://example.com/custom-scalar.js';
    const html = renderDocsHtml({ specUrl: '/openapi.json', ui: 'scalar', cdnUrl: custom });
    expect(html).toContain(custom);
    expect(html).not.toContain(SCALAR_CDN_URL);
  });

  it('spec url is escaped', () => {
    const dangerous = '</script>"\'&<';
    const html = renderDocsHtml({ specUrl: dangerous, ui: 'scalar' });
    expect(html).not.toContain('</script>"');
    // No raw closing script tag from the interpolated value.
    const scriptTagCount = (html.match(/<\/script>/g) ?? []).length;
    // Only the legitimate closing tags for the two <script> elements Scalar renders.
    expect(scriptTagCount).toBe(2);
  });

  it('pins match cdn.ts', () => {
    expect(SCALAR_CDN_URL).toContain(SCALAR_VERSION);
    expect(SWAGGER_UI_JS_CDN_URL).toContain(SWAGGER_UI_VERSION);
    expect(SWAGGER_UI_CSS_CDN_URL).toContain(SWAGGER_UI_VERSION);
  });
});
