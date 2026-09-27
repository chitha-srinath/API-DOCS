import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import { ApiDocsConfigError } from '../../src/config/errors.js';
import { SCALAR_CDN_URL } from '../../src/docs/cdn.js';
import { createApiDocs } from '../../src/serve/router.js';
import { expectValidSpec } from '../fixtures/validate-spec.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('createApiDocs on Express $major', ({ express }) => {
  it('AC-035: zero options give spec, Scalar docs, request validation, no response validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = createApiDocs();
    const app = express();
    app.use(express.json());
    app.use(api.router);
    app.post(
      '/users',
      ...api.route(
        { body: z.object({ name: z.string() }), responses: { 201: z.object({ id: z.number() }) } },
        (_req, res) => res.status(201).json({ id: 'wrong' } as never),
      ),
    );
    const spec = await request(app).get('/openapi.json');
    expect(spec.status).toBe(200);
    await expectValidSpec(spec.body);
    const docs = await request(app).get('/docs');
    expect(docs.status).toBe(200);
    expect(docs.headers['content-type']).toMatch(/^text\/html/);
    expect(docs.text).toContain(SCALAR_CDN_URL);
    expect(docs.text).toContain('"/openapi.json"');
    const invalid = await request(app).post('/users').send({});
    expect(invalid.status).toBe(400);
    expect(invalid.headers['content-type']).toMatch(/^application\/problem\+json/);
    const unvalidated = await request(app).post('/users').send({ name: 'a' });
    expect(unvalidated.status).toBe(201);
    expect(unvalidated.body).toEqual({ id: 'wrong' });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('AC-036: DEFAULT_OPTIONS deep-equals the zero-option resolved config', () => {
    expect(createApiDocs().options).toEqual(DEFAULT_OPTIONS);
    expect(Object.isFrozen(createApiDocs().options.openapi.info)).toBe(true);
  });

  it('AC-037: custom paths, Swagger UI and CDN; defaults are gone', async () => {
    const api = createApiDocs({
      logger: spyLogger(),
      specPath: '/spec.json',
      docsPath: '/reference',
      ui: 'swagger-ui',
      cdnUrl: 'https://cdn.example.com/swagger-ui',
    });
    const app = express();
    app.use(api.router);
    expect((await request(app).get('/spec.json')).status).toBe(200);
    const docs = await request(app).get('/reference');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('https://cdn.example.com/swagger-ui/swagger-ui-bundle.js');
    expect(docs.text).toContain('url: "/spec.json"');
    expect((await request(app).get('/openapi.json')).status).toBe(404);
    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('serves under a mount prefix and points docs at the prefixed spec', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use('/meta', api.router);
    expect((await request(app).get('/meta/openapi.json')).status).toBe(200);
    expect((await request(app).get('/meta/docs/')).text).toContain('"/meta/openapi.json"');
    expect((await request(app).head('/meta/openapi.json')).status).toBe(200);
    expect((await request(app).post('/meta/openapi.json')).status).toBe(404);
  });

  it('AC-043: serveDocs / serveSpec toggles and docs.specUrl', async () => {
    const noDocs = createApiDocs({ logger: spyLogger(), serveDocs: false });
    const a = express();
    a.use(noDocs.router);
    expect((await request(a).get('/docs')).status).toBe(404);
    expect((await request(a).get('/openapi.json')).status).toBe(200);

    const neither = createApiDocs({ logger: spyLogger(), serveSpec: false, serveDocs: false });
    const b = express();
    b.use(neither.router);
    b.get('/x', (_q, r) => r.end());
    expect((await request(b).get('/openapi.json')).status).toBe(404);
    expect(Object.keys(neither.getSpec({ app: b }).paths)).toEqual(['/x']);

    expect(() => createApiDocs({ serveSpec: false, serveDocs: true })).toThrow(ApiDocsConfigError);
    expect(() => createApiDocs({ serveSpec: false })).toThrow(/serveSpec[\s\S]*docs\.specUrl/);

    const external = createApiDocs({
      logger: spyLogger(),
      serveSpec: false,
      docs: { specUrl: 'https://example.com/openapi.json', title: 'External' },
    });
    const c = express();
    c.use(external.router);
    const docs = await request(c).get('/docs');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('"https://example.com/openapi.json"');
    expect(docs.text).toContain('<title>External</title>');
    expect((await request(c).get('/openapi.json')).status).toBe(404);
  });

  it('AC-045: invalid options throw synchronously before anything is mounted', () => {
    const app = express();
    const use = vi.spyOn(app, 'use');
    expect(() => app.use(createApiDocs({ specPth: '/x' } as never).router)).toThrow(
      ApiDocsConfigError,
    );
    expect(() => createApiDocs({ ui: 'redoc' } as never)).toThrow(
      /ui[\s\S]*scalar[\s\S]*swagger-ui/,
    );
    expect(() => createApiDocs({ validateResponses: 'maybe' } as never)).toThrow(
      /validateResponses/,
    );
    expect(() => createApiDocs({ specPath: 'no-slash' })).toThrow(/specPath/);
    expect(use).not.toHaveBeenCalled();
  });

  it('route() rejects values the adapter does not support', () => {
    const api = createApiDocs({ logger: spyLogger() });
    expect(() => api.route({ body: { not: 'a schema' } }, () => undefined)).toThrow(
      /"body" is not a schema/,
    );
    expect(() =>
      api.route({ responses: { 200: { schema: { nope: 1 } } } }, () => undefined),
    ).toThrow(ApiDocsConfigError);
    expect(() => api.route({ responses: { 999: z.string() } as never }, () => undefined)).toThrow(
      /responses\.999/,
    );
    expect(() => api.route({ responses: 'x' as never }, () => undefined)).toThrow(
      /route\.responses/,
    );
    expect(() => api.route({ responses: { 200: 5 } }, () => undefined)).not.toThrow();
  });

  it('spec errors reach the error middleware', async () => {
    const api = createApiDocs({
      logger: spyLogger(),
      operationIdStrategy: () => {
        throw new Error('strategy broke');
      },
    });
    const app = express();
    app.use(api.router);
    app.get('/x', (_q, r) => r.end());
    app.use((err: Error, _q: any, res: any, _n: any) => res.status(500).send(err.message));
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(500);
    expect(res.text).toBe('strategy broke');
  });

  it('caches the spec until the app changes or invalidate() is called', async () => {
    let calls = 0;
    const api = createApiDocs({
      logger: spyLogger(),
      tagStrategy: () => {
        calls += 1;
        return ['t'];
      },
    });
    const app = express();
    app.use(api.router);
    app.get('/x', (_q, r) => r.end());
    await request(app).get('/openapi.json');
    await request(app).get('/openapi.json');
    expect(calls).toBe(1);
    api.invalidate();
    await request(app).get('/openapi.json');
    expect(calls).toBe(2);
    // getSpec() reuses the app seen by the last request
    expect(Object.keys(api.getSpec().paths)).toEqual(['/x']);
    expect(calls).toBe(2);
  });

  it('the default logger writes warnings to console.warn with the code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = createApiDocs();
    api.route({ summary: 'lost' }, () => undefined);
    api.getSpec({ app: express() });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[express-api-docs\] EAD_REGISTRY_UNLOCATED: /),
    );
    warn.mockRestore();
  });
});
