// ST-007 (S-07): AC-043 — serveSpec/serveDocs toggles and the A-9 cross-field
// synchronous throw.
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { ApiDocsConfigError } from '../../src/config/errors.js';
import { createApiDocs } from '../../src/serve/router.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('serve/toggles ($alias)', ({ express }) => {
  it('serveDocs: false -> docs 404, spec still served', async () => {
    const ex = express as { (): import('express').Application };
    const app = ex();
    const apiDocs = createApiDocs({ serveDocs: false });
    app.use(apiDocs.router);
    expect((await request(app).get('/docs')).status).toBe(404);
    expect((await request(app).get('/openapi.json')).status).toBe(200);
  });

  it('serveSpec: false, serveDocs: false with docs.specUrl set -> spec 404, still available via getSpec()', async () => {
    const ex = express as { (): import('express').Application };
    const app = ex();
    const apiDocs = createApiDocs({
      serveSpec: false,
      serveDocs: false,
      docs: { specUrl: 'https://example.com/openapi.json' },
    });
    app.use(apiDocs.router);
    expect((await request(app).get('/openapi.json')).status).toBe(404);
    const spec = apiDocs.getSpec();
    expect(spec.openapi).toBeDefined();
  });

  it('serveSpec: false, serveDocs: true and no docs.specUrl throws ApiDocsConfigError synchronously', () => {
    expect(() => createApiDocs({ serveSpec: false, serveDocs: true })).toThrow(ApiDocsConfigError);
    try {
      createApiDocs({ serveSpec: false, serveDocs: true });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiDocsConfigError);
      const configErr = err as ApiDocsConfigError;
      expect(configErr.path).toBe('serveSpec');
      expect(configErr.message).toContain('serveSpec');
      expect(configErr.message).toContain('docs.specUrl');
    }
  });

  it('serveSpec: false, serveDocs: true, docs.specUrl set -> docs 200 pointing at it, spec 404', async () => {
    const ex = express as { (): import('express').Application };
    const app = ex();
    const url = 'https://example.com/openapi.json';
    const apiDocs = createApiDocs({ serveSpec: false, serveDocs: true, docs: { specUrl: url } });
    app.use(apiDocs.router);
    const docs = await request(app).get('/docs');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain(url);
    expect((await request(app).get('/openapi.json')).status).toBe(404);
  });
});
