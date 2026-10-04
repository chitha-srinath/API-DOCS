// Regression: the Scalar data-url attribute and the Swagger UI url must carry the
// bare spec path. An earlier encoding wrapped it in literal quotes (Scalar then
// requested /%22/openapi.json%22 and failed; Swagger emitted a syntax error).
import { describe, expect, it } from 'vitest';
import { renderDocsHtml } from '../../src/docs/render.js';

describe('docs/render spec URL embedding', () => {
  it('scalar: data-url attribute holds the bare spec path', () => {
    const html = renderDocsHtml({ specUrl: '/openapi.json', ui: 'scalar' });
    expect(html).toContain('data-url="/openapi.json"');
    expect(html).not.toContain('&quot;');
  });

  it('scalar: a specUrl with markup characters is attribute-escaped', () => {
    const html = renderDocsHtml({ specUrl: '/a"b</script>&', ui: 'scalar' });
    expect(html).toContain('data-url="/a&quot;b&lt;/script&gt;&amp;"');
    expect(html).not.toContain('</script>&');
  });

  it('swagger-ui: url is a JS string literal the browser can parse', () => {
    const html = renderDocsHtml({ specUrl: '/openapi.json', ui: 'swagger-ui' });
    expect(html).toContain('url: "/openapi.json"');
    expect(html).not.toContain('&quot;');
  });

  it('swagger-ui: < is unicode-escaped so </script> cannot close the tag', () => {
    const html = renderDocsHtml({ specUrl: '/x</script>', ui: 'swagger-ui' });
    expect(html).toContain('url: "/x\\u003c/script>"');
    expect(html.match(/<\/script>/g)?.length).toBe(2);
  });
});
