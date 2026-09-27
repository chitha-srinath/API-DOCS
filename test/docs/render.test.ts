import { describe, expect, it } from 'vitest';
import {
  SCALAR_CDN_URL,
  SCALAR_VERSION,
  SWAGGER_UI_CDN_URL,
  SWAGGER_UI_VERSION,
} from '../../src/docs/cdn.js';
import { escapeHtml, renderDocs, scriptJson } from '../../src/docs/render.js';

describe('CDN pins', () => {
  it('pins exact versions', () => {
    expect(SCALAR_VERSION).toBe('1.72.1');
    expect(SWAGGER_UI_VERSION).toBe('5.33.0');
    expect(SCALAR_CDN_URL).toBe('https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1');
    expect(SWAGGER_UI_CDN_URL).toBe('https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.0');
  });
});

describe('renderDocs', () => {
  it('AC-018: Scalar from the pinned CDN, pointed at the spec', () => {
    const html = renderDocs({
      ui: 'scalar',
      specUrl: '/openapi.json',
      title: 'My API',
      cdnUrl: null,
    });
    expect(html).toContain(`<script src="${SCALAR_CDN_URL}"></script>`);
    expect(html).toContain(`Scalar.createApiReference('#app', { url: "/openapi.json" })`);
    expect(html).toContain('<title>My API</title>');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('AC-019: Swagger UI from the pinned CDN, or a custom base URL', () => {
    const html = renderDocs({ ui: 'swagger-ui', specUrl: '/spec.json', title: 'T', cdnUrl: null });
    expect(html).toContain(`<script src="${SWAGGER_UI_CDN_URL}/swagger-ui-bundle.js"></script>`);
    expect(html).toContain(`<link rel="stylesheet" href="${SWAGGER_UI_CDN_URL}/swagger-ui.css" />`);
    expect(html).toContain(`SwaggerUIBundle({ url: "/spec.json", dom_id: '#swagger-ui' })`);
    const custom = renderDocs({
      ui: 'swagger-ui',
      specUrl: '/s',
      title: 'T',
      cdnUrl: 'https://my.cdn/sui/',
    });
    expect(custom).toContain('<script src="https://my.cdn/sui/swagger-ui-bundle.js"></script>');
    expect(custom).not.toContain('jsdelivr');
    const scalar = renderDocs({
      ui: 'scalar',
      specUrl: '/s',
      title: 'T',
      cdnUrl: 'https://my.cdn/scalar.js',
    });
    expect(scalar).toContain('<script src="https://my.cdn/scalar.js"></script>');
  });

  it('escapes the title, URLs and script data', () => {
    const html = renderDocs({
      ui: 'scalar',
      specUrl: '/x</script><script>alert(1)</script>',
      title: '<b>&"',
      cdnUrl: 'https://c/"x',
    });
    expect(html).toContain('<title>&lt;b&gt;&amp;&quot;</title>');
    expect(html).toContain('src="https://c/&quot;x"');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script\\u003e');
  });

  it('helpers', () => {
    expect(escapeHtml(`'`)).toBe('&#39;');
    expect(scriptJson('a&b\u2028\u2029>')).toBe('"a\\u0026b\\u2028\\u2029\\u003e"');
  });
});
