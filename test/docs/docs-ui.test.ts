import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApiDocs } from '../../src/index.js';

function appWith(options?: Parameters<typeof createApiDocs>[0]) {
  const apiDocs = createApiDocs(options);
  const app = express();
  app.use(apiDocs.router);
  return { app, apiDocs };
}

describe('rendered docs UI', () => {
  it('serves the shadcn UI at /docs by default, with the spec path injected', async () => {
    const { app } = appWith();
    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
    expect(res.text).toContain('window.__API_DOCS__ = {"specPath":"/openapi.json"}');
    expect(res.text).not.toContain('swagger');
  });

  it('points asset URLs at the docs mount and serves the built JS', async () => {
    const { app } = appWith({ docsPath: '/api-docs' });
    const page = await request(app).get('/api-docs');
    const match = page.text.match(/\/api-docs\/assets\/(index-[^"]+\.js)/);
    expect(match).not.toBeNull();

    const asset = await request(app).get(`/api-docs/assets/${match?.[1]}`);
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toMatch(/javascript/);
  });

  it('returns 404 for unknown or traversal asset names', async () => {
    const { app } = appWith();
    expect((await request(app).get('/docs/assets/nope.js')).status).toBe(404);
  });

  it('serves the UI at a configured docsPath and not at /docs', async () => {
    const { app } = appWith({ docsPath: '/api-docs' });
    expect((await request(app).get('/api-docs')).status).toBe(200);
    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('injects a configured specPath', async () => {
    const { app } = appWith({ specPath: '/spec.json' });
    expect((await request(app).get('/docs')).text).toContain('"specPath":"/spec.json"');
  });

  it('does not mount the UI when serveDocs is false', async () => {
    const { app } = appWith({ serveDocs: false });
    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('keeps the docs page out of the generated spec', async () => {
    const { app, apiDocs } = appWith();
    app.get('/hello', (_req, res) => res.send('hi'));
    const spec = apiDocs.getSpec({ app });
    expect(Object.keys(spec.paths as object)).not.toContain('/docs');
  });

  it('rejects a docsPath without a leading slash', () => {
    expect(() => createApiDocs({ docsPath: 'docs' } as never)).toThrow();
  });
});
