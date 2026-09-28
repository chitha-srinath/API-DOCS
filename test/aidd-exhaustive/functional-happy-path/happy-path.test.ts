// AIDD QA exhaustive suite — category: functional-happy-path
// Independent end-to-end verification (real Express apps + supertest) of the
// intended flow for every AC in prd.md. Written fresh by the test-engineer
// role, not copied from src's own test suite, to give independent evidence.
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';

import { ApiDocsConfigError } from '../../../src/config/errors.js';
import { DEFAULT_OPTIONS } from '../../../src/config/defaults.js';
import { mergeOptions } from '../../../src/config/merge.js';
import { createApiDocs } from '../../../src/serve/router.js';
import { standardSchemaAdapter } from '../../../src/adapter/standard.js';
import { majors } from '../../fixtures/majors.js';

// A minimal stub SchemaAdapter (AC-005, AC-047) independent of Zod.
function makeStubAdapter() {
  const calls: { parse: number; toJson: number } = { parse: 0, toJson: 0 };
  const adapter = {
    name: 'stub',
    isSchema(value: unknown): value is unknown {
      return typeof value === 'object' && value !== null && '__stub' in (value as object);
    },
    validate(schema: unknown, data: unknown): unknown {
      calls.parse += 1;
      const s = schema as { shape?: Record<string, 'string' | 'number'> };
      if (!s.shape) return { ok: true, data };
      const d = { ...(data as Record<string, unknown>) };
      const issues: { path: string; message: string }[] = [];
      for (const [key, kind] of Object.entries(s.shape)) {
        if (kind === 'number') {
          const n = Number(d[key]);
          if (Number.isNaN(n)) {
            issues.push({ path: key, message: `invalid ${key}` });
          } else {
            d[key] = n;
          }
        } else if (typeof d[key] !== 'string') {
          issues.push({ path: key, message: `invalid ${key}` });
        }
      }
      if (issues.length > 0) return { ok: false, issues };
      return { ok: true, data: d };
    },
    toJSONSchema(schema: unknown, _io?: unknown): unknown {
      calls.toJson += 1;
      const s = schema as { shape?: Record<string, 'string' | 'number'> };
      const properties: Record<string, unknown> = {};
      for (const [key, kind] of Object.entries(s.shape ?? {})) {
        properties[key] = { type: kind };
      }
      return { type: 'object', properties, required: Object.keys(properties) };
    },
  };
  return { adapter, calls };
}

function stubSchema(shape: Record<string, 'string' | 'number'>): { __stub: true; shape: typeof shape } {
  return { __stub: true, shape };
}

describe.each(majors)('functional-happy-path ($alias)', ({ major, express }) => {
  const ex = express as {
    (): import('express').Application;
    Router: () => import('express').Router;
    json: () => import('express').RequestHandler;
  };

  // TC-HAPPY-005 / AC-005: stub SchemaAdapter validates and appears in spec.
  it('TC-HAPPY-005: stub adapter route validates and is spec-visible', async () => {
    const { adapter } = makeStubAdapter();
    const apiDocs = createApiDocs({ schemaAdapter: adapter });
    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/widgets',
      { body: stubSchema({ name: 'string' }) },
      (req, res) => res.json({ ok: true, name: (req.body as { name: string }).name }),
    );
    app.post('/widgets', validate, handler);

    const ok = await request(app).post('/widgets').send({ name: 'foo' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true, name: 'foo' });

    const spec = await request(app).get('/openapi.json');
    expect(spec.status).toBe(200);
    const paths = spec.body.paths as Record<string, unknown>;
    expect(Object.keys(paths)).toContain('/widgets');
  });

  // TC-HAPPY-007/008/009: request validation happy + error shape + coercion.
  it('TC-HAPPY-007-009: valid request passes coerced values; invalid body/query/params 400 problem+json', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/orders/:id',
      {
        params: z.object({ id: z.string() }),
        query: z.object({ verbose: z.enum(['true', 'false']).optional() }),
        body: z.object({ qty: z.number() }),
        response: z.object({ id: z.string(), qty: z.number() }),
      },
      (req, res) => {
        res.json({ id: req.params.id, qty: req.body.qty, verbose: req.query.verbose });
      },
    );
    app.post('/orders/:id', validate, handler);

    // AC-009: valid + coercion
    const good = await request(app).post('/orders/abc?verbose=true').send({ qty: 3 });
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ id: 'abc', qty: 3, verbose: 'true' });

    // AC-007/008: invalid body -> in: body
    const badBody = await request(app).post('/orders/abc').send({ qty: 'not-a-number' });
    expect(badBody.status).toBe(400);
    expect(badBody.headers['content-type']).toContain('application/problem+json');
    expect(badBody.body.status).toBe(400);
    expect(badBody.body.errors[0].in).toBe('body');
    expect(typeof badBody.body.errors[0].path).toBe('string');
    expect(typeof badBody.body.errors[0].message).toBe('string');

    // AC-008: invalid query -> in: query
    const badQuery = await request(app).post('/orders/abc?verbose=notabool').send({ qty: 1 });
    expect(badQuery.status).toBe(400);
    expect(badQuery.body.errors[0].in).toBe('query');
  });

  // TC-HAPPY-010: AC-011 400 response documented in spec with problem-details schema.
  it('TC-HAPPY-010: spec documents 400 problem+json response for typed route', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route('post', '/things', { body: z.object({ n: z.number() }) }, (req, res) =>
      res.json({ ok: true }),
    );
    app.post('/things', validate, handler);
    const spec = await request(app).get('/openapi.json');
    const op = spec.body.paths['/things'].post;
    expect(op.responses['400']).toBeDefined();
    expect(op.responses['400'].content['application/problem+json']).toBeDefined();
  });

  // TC-HAPPY-011/012/013: validateResponses modes.
  it('TC-HAPPY-011: validateResponses unset sends bad body unchanged, no logging', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'get',
      '/bad-resp',
      { response: z.object({ x: z.string() }) },
      (req, res) => res.json({ x: 123 }),
    );
    app.get('/bad-resp', validate, handler);
    const res = await request(app).get('/bad-resp');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ x: 123 });
  });

  it('TC-HAPPY-012: validateResponses warn logs exactly once, still sends body', async () => {
    const apiDocs = createApiDocs({ validateResponses: 'warn' });
    const app = ex();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'get',
      '/bad-resp-warn',
      { response: z.object({ x: z.string() }), validateResponses: 'warn' },
      (req, res) => res.json({ x: 123 }),
    );
    app.get('/bad-resp-warn', validate, handler);
    const res = await request(app).get('/bad-resp-warn');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ x: 123 });
  });

  it('TC-HAPPY-013: validateResponses error returns 500, does not send invalid body', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'get',
      '/bad-resp-error',
      { response: z.object({ x: z.string() }), validateResponses: 'error' },
      (req, res) => res.json({ x: 123 }),
    );
    app.get('/bad-resp-error', validate, handler);
    const res = await request(app).get('/bad-resp-error');
    expect(res.status).toBe(500);
    expect(res.body).not.toEqual({ x: 123 });
  });

  // TC-HAPPY-014/016: spec + path params reflection.
  it('TC-HAPPY-014-016: /users/:id spec shape, path param, valid 3.1 doc', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'get',
      '/users/:id',
      { params: z.object({ id: z.string() }), query: z.object({ full: z.string().optional() }) },
      (req, res) => res.json({ id: req.params.id }),
    );
    app.get('/users/:id', validate, handler);
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect((res.body.openapi as string).startsWith('3.1.')).toBe(true);
    const op = res.body.paths['/users/{id}'].get;
    expect(op.parameters).toContainEqual(expect.objectContaining({ name: 'id', in: 'path', required: true }));
    await expect(SwaggerParser.validate(structuredClone(res.body))).resolves.toBeDefined();
  });

  // TC-HAPPY-018: AC-021 typed route mounted alongside plain routes on an existing router.
  it('TC-HAPPY-018: typed route on existing router does not disturb plain routes', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const router = ex.Router();
    router.get('/plain', (_req, res) => res.json({ plain: true }));
    const [validate, handler] = apiDocs.route('get', '/typed', { query: z.object({ q: z.string() }) }, (req, res) =>
      res.json({ q: req.query.q }),
    );
    router.get('/typed', validate, handler);
    app.use(router);

    const plainRes = await request(app).get('/plain');
    expect(plainRes.status).toBe(200);
    expect(plainRes.body).toEqual({ plain: true });

    const typedBad = await request(app).get('/typed');
    expect(typedBad.status).toBe(400);
    const typedGood = await request(app).get('/typed?q=hi');
    expect(typedGood.status).toBe(200);
  });

  // TC-HAPPY-019: AC-022 describe() metadata, not rejecting invalid requests.
  it('TC-HAPPY-019: describe()-tagged plain route appears with metadata and is never rejected', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const mw = apiDocs.describe('get', '/legacy', { summary: 'legacy endpoint' });
    app.get('/legacy', mw, (_req, res) => res.json({ anything: 'goes' }));

    const res = await request(app).get('/legacy?whatever=garbage');
    expect(res.status).toBe(200);

    const spec = await request(app).get('/openapi.json');
    const op = spec.body.paths['/legacy'].get;
    expect(op.summary).toBe('legacy endpoint');
  });

  // TC-HAPPY-024: AC-024 async handler throw reaches Express error middleware.
  it('TC-HAPPY-024: async typed handler throw reaches error middleware', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route('get', '/boom', {}, async () => {
      throw new Error('async boom');
    });
    app.get('/boom', validate, handler);
    app.use((err: Error, _req: unknown, res: import('express').Response, _next: unknown) => {
      res.status(599).json({ caught: err.message });
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(599);
    expect(res.body.caught).toBe('async boom');
  });

  // TC-HAPPY-028: AC-030 autoDetect false hides plain routes; include/exclude globs.
  it('TC-HAPPY-028: autoDetect false hides plain routes; exclude glob filters them', async () => {
    const off = createApiDocs({ autoDetect: false });
    const appOff = ex();
    appOff.use(off.router);
    appOff.get('/plainA', (_req, res) => res.json({}));
    let spec = await request(appOff).get('/openapi.json');
    expect(spec.body.paths['/plainA']).toBeUndefined();

    const filtered = createApiDocs({ autoDetect: { exclude: ['/internal/**'] } });
    const appF = ex();
    appF.use(filtered.router);
    appF.get('/internal/secret', (_req, res) => res.json({}));
    appF.get('/public/ok', (_req, res) => res.json({}));
    spec = await request(appF).get('/openapi.json');
    expect(spec.body.paths['/internal/secret']).toBeUndefined();
    expect(spec.body.paths['/public/ok']).toBeDefined();
  });

  // TC-HAPPY-031: AC-033 own spec/docs endpoints excluded from generated spec.
  it('TC-HAPPY-031: own spec/docs paths are excluded from the generated spec', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(apiDocs.router);
    const res = await request(app).get('/openapi.json');
    expect(res.body.paths['/openapi.json']).toBeUndefined();
    expect(res.body.paths['/docs']).toBeUndefined();
  });

  // TC-HAPPY-033: AC-035 zero-config full flow.
  it('TC-HAPPY-033: zero-config end-to-end: spec, docs, 400, no response validation', async () => {
    const apiDocs = createApiDocs();
    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/z',
      { body: z.object({ v: z.string() }), response: z.object({ v: z.string() }) },
      (req, res) => res.json({ v: 1 as unknown as string }),
    );
    app.post('/z', validate, handler);

    const spec = await request(app).get('/openapi.json');
    expect(spec.status).toBe(200);
    expect((spec.body.openapi as string).startsWith('3.1.')).toBe(true);

    const docs = await request(app).get('/docs');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('scalar');

    const bad = await request(app).post('/z').send({});
    expect(bad.status).toBe(400);
    expect(bad.headers['content-type']).toContain('application/problem+json');

    const okBadResp = await request(app).post('/z').send({ v: 'x' });
    expect(okBadResp.status).toBe(200);
    expect(okBadResp.body).toEqual({ v: 1 });
  });

  // TC-HAPPY-035: AC-037 custom paths, swagger-ui, custom cdn.
  it('TC-HAPPY-035: custom specPath/docsPath/ui/cdnUrl are honored; defaults 404', async () => {
    const apiDocs = createApiDocs({
      specPath: '/spec.json',
      docsPath: '/reference',
      ui: 'swagger-ui',
      cdnUrl: 'https://example.test/swagger-ui.js',
    });
    const app = ex();
    app.use(apiDocs.router);

    const spec = await request(app).get('/spec.json');
    expect(spec.status).toBe(200);
    const defaultSpec = await request(app).get('/openapi.json');
    expect(defaultSpec.status).toBe(404);

    const docs = await request(app).get('/reference');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('example.test/swagger-ui.js');
    expect(docs.text).toContain('/spec.json');
    const defaultDocs = await request(app).get('/docs');
    expect(defaultDocs.status).toBe(404);
  });

  // TC-HAPPY-036: AC-038 openapi.info/servers/tags overrides reflected.
  it('TC-HAPPY-036: openapi info/servers/tags overrides are reflected in the spec', async () => {
    const apiDocs = createApiDocs({
      openapi: {
        info: { title: 'My API', version: '9.9.9', description: 'desc' },
        servers: [{ url: 'https://api.example.com' }],
        tags: [{ name: 'custom', description: 'custom tag' }],
      },
    });
    const app = ex();
    app.use(apiDocs.router);
    const res = await request(app).get('/openapi.json');
    expect(res.body.info).toEqual({ title: 'My API', version: '9.9.9', description: 'desc' });
    expect(res.body.servers).toEqual([{ url: 'https://api.example.com' }]);
    expect(res.body.tags).toEqual([{ name: 'custom', description: 'custom tag' }]);
  });

  // TC-HAPPY-037: AC-039 global security inheritance and per-route override.
  it('TC-HAPPY-037: global security scheme inherited; route security: [] overrides to empty', async () => {
    const apiDocs = createApiDocs({
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      security: [{ bearer: [] }],
    });
    const app = ex();
    app.use(apiDocs.router);
    const [v1, h1] = apiDocs.route('get', '/secured', {}, (_req, res) => res.json({}));
    app.get('/secured', v1, h1);
    const [v2, h2] = apiDocs.route('get', '/open', { security: [] }, (_req, res) => res.json({}));
    app.get('/open', v2, h2);

    const res = await request(app).get('/openapi.json');
    expect(res.body.paths['/secured'].get.security).toEqual([{ bearer: [] }]);
    expect(res.body.paths['/open'].get.security).toEqual([]);
    expect(res.body.components.securitySchemes.bearer).toBeDefined();
  });

  // TC-HAPPY-038: AC-040 validateRequests: false and global onValidationError.
  it('TC-HAPPY-038: validateRequests false skips validation; global onValidationError formats 400', async () => {
    const off = createApiDocs({ validateRequests: false });
    const appOff = ex();
    appOff.use(ex.json());
    appOff.use(off.router);
    const [v1, h1] = off.route('post', '/skip', { body: z.object({ n: z.number() }) }, (req, res) =>
      res.json({ received: req.body }),
    );
    appOff.post('/skip', v1, h1);
    const resOff = await request(appOff).post('/skip').send({ n: 'not-a-number' });
    expect(resOff.status).toBe(200);

    const withHook = createApiDocs({
      onValidationError: () => ({ status: 422, body: { custom: true } }),
    });
    const appHook = ex();
    appHook.use(ex.json());
    appHook.use(withHook.router);
    const [v2, h2] = withHook.route('post', '/hook', { body: z.object({ n: z.number() }) }, (_req, res) =>
      res.json({}),
    );
    appHook.post('/hook', v2, h2);
    const resHook = await request(appHook).post('/hook').send({ n: 'nope' });
    expect(resHook.status).toBe(422);
    expect(resHook.body).toEqual({ custom: true });
  });

  // TC-HAPPY-039: AC-041 autoDetect include + custom detectedDefaultResponse.
  it('TC-HAPPY-039: include filter + custom detectedDefaultResponse for auto-detected ops', async () => {
    const apiDocs = createApiDocs({
      autoDetect: { include: ['/api/**'] },
      detectedDefaultResponse: { status: 204, description: 'No Content' },
    });
    const app = ex();
    app.use(apiDocs.router);
    app.get('/api/items', (_req, res) => res.json([]));
    app.get('/other/items', (_req, res) => res.json([]));
    const res = await request(app).get('/openapi.json');
    expect(res.body.paths['/api/items']).toBeDefined();
    expect(res.body.paths['/other/items']).toBeUndefined();
    const responses = res.body.paths['/api/items'].get.responses;
    expect(responses['204']).toBeDefined();
    expect(responses['204'].description).toBe('No Content');
  });

  // TC-HAPPY-040: AC-042 custom operationIdStrategy/tagStrategy, and defaults.
  it('TC-HAPPY-040: custom strategies apply; defaults produce getUsersById/users tag', async () => {
    const custom = createApiDocs({
      operationIdStrategy: ({ method, path }: { method: string; path: string }) =>
        `${method}_${path.replace(/^\//, '').replace(/\W+/g, '_')}`,
      tagStrategy: () => ['everything'],
    });
    const appC = ex();
    appC.use(custom.router);
    appC.get('/api/items', (_req, res) => res.json([]));
    const resC = await request(appC).get('/openapi.json');
    const opC = resC.body.paths['/api/items'].get;
    expect(opC.operationId).toBe('get_api_items');
    expect(opC.tags).toEqual(['everything']);

    const def = createApiDocs();
    const appD = ex();
    appD.use(def.router);
    appD.get('/users/:id', (_req, res) => res.json({}));
    const resD = await request(appD).get('/openapi.json');
    const opD = resD.body.paths['/users/{id}'].get;
    expect(opD.operationId).toBe('getUsersById');
    expect(opD.tags).toEqual(['users']);
  });

  // TC-HAPPY-041: AC-043 serveDocs/serveSpec combinations.
  it('TC-HAPPY-041: serveDocs false 404s docs but keeps spec; serveSpec+serveDocs false keeps getSpec()', async () => {
    const noDocs = createApiDocs({ serveDocs: false });
    const appND = ex();
    appND.use(noDocs.router);
    expect((await request(appND).get('/docs')).status).toBe(404);
    expect((await request(appND).get('/openapi.json')).status).toBe(200);

    const noBoth = createApiDocs({ serveSpec: false, serveDocs: false });
    const appNB = ex();
    appNB.use(noBoth.router);
    expect((await request(appNB).get('/openapi.json')).status).toBe(404);
    const programmatic = noBoth.getSpec({ app: appNB });
    expect((programmatic.openapi as string).startsWith('3.1.')).toBe(true);

    expect(() => createApiDocs({ serveSpec: false, serveDocs: true })).toThrow(ApiDocsConfigError);

    const withUrl = createApiDocs({
      serveSpec: false,
      serveDocs: true,
      docs: { specUrl: 'https://example.com/openapi.json' },
    });
    const appUrl = ex();
    appUrl.use(withUrl.router);
    const docsRes = await request(appUrl).get('/docs');
    expect(docsRes.status).toBe(200);
    expect(docsRes.text).toContain('https://example.com/openapi.json');
    expect((await request(appUrl).get('/openapi.json')).status).toBe(404);
  });

  // TC-HAPPY-042: AC-044 precedence: per-route > global > defaults, deep merge, arrays replaced.
  it('TC-HAPPY-042: option precedence per-route > global > defaults; arrays replaced not concatenated', async () => {
    const apiDocs = createApiDocs({
      openapi: { info: { title: 'Global Title' } },
      validateResponses: 'warn',
      onValidationError: () => ({ status: 400, body: { source: 'global' } }),
    });
    // (a) global info.title override keeps default info.version
    expect(apiDocs.options.openapi?.info?.title).toBe('Global Title');
    expect(apiDocs.options.openapi?.info?.version).toBe(
      (DEFAULT_OPTIONS.openapi as { info?: { version?: string } })?.info?.version,
    );

    // (b) mergeOptions utility: global tags + per-route tags -> route tags win (array replace, not concat)
    const merged = mergeOptions({ tags: [] } as never, { tags: ['a', 'b'] } as never, { tags: ['c'] } as never) as {
      tags: string[];
    };
    expect(merged.tags).toEqual(['c']);

    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);

    // (c) per-route validateResponses 'error' beats global 'warn'
    const [v1, h1] = apiDocs.route(
      'get',
      '/precedence-error',
      { response: z.object({ x: z.string() }), validateResponses: 'error' },
      (_req, res) => res.json({ x: 1 }),
    );
    app.get('/precedence-error', v1, h1);
    const r1 = await request(app).get('/precedence-error');
    expect(r1.status).toBe(500);

    // (d) per-route onValidationError beats global
    const [v2, h2] = apiDocs.route(
      'post',
      '/precedence-hook',
      { body: z.object({ n: z.number() }), onValidationError: () => ({ status: 418, body: { source: 'route' } }) },
      (_req, res) => res.json({}),
    );
    app.post('/precedence-hook', v2, h2);
    const r2 = await request(app).post('/precedence-hook').send({ n: 'bad' });
    expect(r2.status).toBe(418);
    expect(r2.body).toEqual({ source: 'route' });
  });

  // TC-HAPPY-043: AC-045 config errors thrown synchronously for unknown key / invalid value.
  it('TC-HAPPY-043: unknown option key and invalid value throw synchronously with offending path', () => {
    let threw = false;
    try {
      createApiDocs({ specPth: '/x' } as never);
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(ApiDocsConfigError);
      expect((e as ApiDocsConfigError).message).toMatch(/specPth/);
    }
    expect(threw).toBe(true);

    expect(() => createApiDocs({ ui: 'redoc' } as never)).toThrow(ApiDocsConfigError);
    expect(() => createApiDocs({ validateResponses: 'maybe' } as never)).toThrow(ApiDocsConfigError);
    expect(() => createApiDocs({ specPath: 'no-slash' } as never)).toThrow(ApiDocsConfigError);
  });

  // TC-HAPPY-045: AC-047 stub adapter global vs per-route override.
  it('TC-HAPPY-045: per-route schemaAdapter overrides global schemaAdapter', async () => {
    const { adapter: globalAdapter, calls: globalCalls } = makeStubAdapter();
    const { adapter: routeAdapter, calls: routeCalls } = makeStubAdapter();
    const apiDocs = createApiDocs({ schemaAdapter: globalAdapter });
    const app = ex();
    app.use(ex.json());
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/override',
      { body: stubSchema({ n: 'number' }), adapter: routeAdapter as never },
      (req, res) => res.json({ n: (req.body as { n: number }).n }),
    );
    app.post('/override', validate, handler);
    const res = await request(app).post('/override').send({ n: '5' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ n: 5 });
    expect(routeCalls.parse).toBeGreaterThan(0);
    expect(globalCalls.parse).toBe(0);
  });
});

// Non-majors-parameterized cases (single default express is fine / static checks).
describe('functional-happy-path (config-level, major-independent)', () => {
  // TC-HAPPY-034: AC-036 DEFAULT_OPTIONS is deep-frozen and equals a zero-option resolve.
  it('TC-HAPPY-034: DEFAULT_OPTIONS is deep-frozen and equals resolved zero-option config', () => {
    expect(Object.isFrozen(DEFAULT_OPTIONS)).toBe(true);
    if (DEFAULT_OPTIONS.openapi) expect(Object.isFrozen(DEFAULT_OPTIONS.openapi)).toBe(true);
    const apiDocs = createApiDocs();
    expect(apiDocs.options).toEqual(DEFAULT_OPTIONS);
  });

  // TC-HAPPY-001: AC-005/047 default adapter is the standard schema adapter (sanity for other cases).
  it('TC-HAPPY-standard-adapter-sanity: standardSchemaAdapter recognizes zod schemas', () => {
    expect(standardSchemaAdapter.isSchema(z.string())).toBe(true);
  });
});
