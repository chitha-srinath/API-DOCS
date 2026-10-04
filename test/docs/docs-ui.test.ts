import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApiDocs } from '../../src/index.js';

describe('rendered docs UI', () => {
  it('serves the UI at /docs by default and points it at /openapi.json', async () => {
    const apiDocs = createApiDocs();
    const app = express();
    app.use(apiDocs.router);

    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('"/openapi.json"');
  });

  it('serves the UI at a configured docsPath and not at /docs', async () => {
    const apiDocs = createApiDocs({ docsPath: '/api-docs' });
    const app = express();
    app.use(apiDocs.router);

    expect((await request(app).get('/api-docs')).status).toBe(200);
    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('does not mount the UI when serveDocs is false', async () => {
    const apiDocs = createApiDocs({ serveDocs: false });
    const app = express();
    app.use(apiDocs.router);

    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('keeps the docs page out of the generated spec', async () => {
    const apiDocs = createApiDocs();
    const app = express();
    app.use(apiDocs.router);
    app.get('/hello', (_req, res) => res.send('hi'));

    const spec = apiDocs.getSpec({ app });
    expect(Object.keys(spec.paths)).not.toContain('/docs');
  });

  it('rejects a docsPath without a leading slash', () => {
    expect(() => createApiDocs({ docsPath: 'docs' } as never)).toThrow();
  });
});
