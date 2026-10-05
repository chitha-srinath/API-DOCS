// AIDD QA — impossible-abuse category (TC-ABUSE-NNN).
// Exhaustive "should never happen" matrix: malformed/oversized bodies, injection
// strings, contradictory config, replayed/reordered registration, duplicate router
// mount, circular refs, deep nesting, and prototype-pollution beyond config/merge
// (route params/query reaching validated schemas). Assert graceful rejection:
// no crash, no corruption, no silent success.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';
import { z } from 'zod';

import { createApiDocs } from '../../../src/index.js';
import { ApiDocsConfigError } from '../../../src/config/errors.js';
import { PROBLEM_CONTENT_TYPE } from '../../../src/route/problem.js';
import { makeRouteFactory } from '../../route/support.js';
import { mergeOptions } from '../../../src/config/merge.js';

function freshApp(): Express {
  return express();
}

describe('impossible-abuse: malformed / oversized bodies', () => {
  // TC-ABUSE-001: malformed JSON body against a typed route -> Express body-parser
  // rejects with 400 before the validator/handler run at all (AC-007 adjacent).
  it('TC-ABUSE-001: truncated/invalid JSON body -> 400, handler never called', async () => {
    const { route } = makeRouteFactory();
    let called = false;
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) => {
      called = true;
      res.json({ ok: true });
    });
    const app = freshApp();
    app.use(express.json());
    app.post('/items', validator, wrapped);

    const res = await request(app)
      .post('/items')
      .set('Content-Type', 'application/json')
      .send('{"a": "unterminated')
      .expect(400);
    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });

  // TC-ABUSE-002: oversized JSON body (over express.json default 100kb limit) -> 413/400, no crash.
  it('TC-ABUSE-002: oversized JSON body -> rejected gracefully, process alive', async () => {
    const { route } = makeRouteFactory();
    let called = false;
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) => {
      called = true;
      res.json({ ok: true });
    });
    const app = freshApp();
    app.use(express.json({ limit: '1kb' }));
    app.post('/items', validator, wrapped);

    const bigPayload = JSON.stringify({ a: 'x'.repeat(50_000) });
    const res = await request(app).post('/items').set('Content-Type', 'application/json').send(bigPayload);
    expect([400, 413]).toContain(res.status);
    expect(called).toBe(false);
  });

  // TC-ABUSE-003: wrong content-type (body sent as text/plain) against a JSON schema route.
  it('TC-ABUSE-003: non-JSON content-type body -> validation fails gracefully, not a crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ ok: true }),
    );
    const app = freshApp();
    app.use(express.json());
    app.post('/items', validator, wrapped);

    const res = await request(app).post('/items').set('Content-Type', 'text/plain').send('a=1');
    // express.json() ignores non-json content-type, body stays {} -> schema validation fails -> 400
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  });

  // TC-ABUSE-004: extremely deeply nested JSON object body against a typed route schema.
  it('TC-ABUSE-004: deeply nested (2000 levels) JSON body -> rejected or handled without crash', async () => {
    const { route } = makeRouteFactory();
    let called = false;
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) => {
      called = true;
      res.json({ ok: true });
    });
    const app = freshApp();
    app.use(express.json({ limit: '5mb' }));
    app.post('/items', validator, wrapped);

    let nested: unknown = { leaf: true };
    for (let i = 0; i < 2000; i++) nested = { nested };
    const payload = JSON.stringify({ a: 'x', deep: nested });

    const res = await request(app).post('/items').set('Content-Type', 'application/json').send(payload);
    // Must not crash the server; either accepted (extra key ignored by zod's default
    // strip behavior) or rejected — both are graceful. A hang/500/crash is a failure.
    expect([200, 400, 413]).toContain(res.status);
    void called;
  });
});

describe('impossible-abuse: injection strings', () => {
  // TC-ABUSE-005: script-tag / HTML injection string in a route param reaching a
  // validated schema -> treated as opaque string data, not executed, and does not
  // corrupt the JSON response.
  it('TC-ABUSE-005: <script> tag in path param -> safely handled as data, valid JSON response', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'get',
      '/users/:id',
      { params: z.object({ id: z.string().min(1) }) },
      (req, res) => res.json({ id: req.params.id }),
    );
    const app = freshApp();
    app.get('/users/:id', validator, wrapped);

    const payload = '<script>alert(1)</script>';
    const res = await request(app)
      .get(`/users/${encodeURIComponent(payload)}`)
      .expect(200);
    expect(res.body.id).toBe(payload);
    expect(res.headers['content-type']).toContain('application/json');
  });

  // TC-ABUSE-006: SQL-injection-shaped string in query param -> passes through as string,
  // no special handling/crash (this package does no persistence, so injection is inert,
  // but must not break coercion/validation).
  it('TC-ABUSE-006: SQL-injection-shaped query string -> validated as plain string, no crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/search', { query: z.object({ q: z.string() }) }, (req, res) =>
      res.json({ q: req.query.q }),
    );
    const app = freshApp();
    app.get('/search', validator, wrapped);

    const payload = "'; DROP TABLE users; --";
    const res = await request(app).get('/search').query({ q: payload }).expect(200);
    expect(res.body.q).toBe(payload);
  });

  // TC-ABUSE-007: path-traversal-shaped string in a path param.
  it('TC-ABUSE-007: path-traversal string in path param -> treated as opaque data', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/files/:name', { params: z.object({ name: z.string() }) }, (req, res) =>
      res.json({ name: req.params.name }),
    );
    const app = freshApp();
    app.get('/files/:name', validator, wrapped);

    const payload = '..%2F..%2F..%2Fetc%2Fpasswd';
    const res = await request(app).get(`/files/${payload}`).expect(200);
    expect(res.body.name).toContain('..');
  });

  // TC-ABUSE-008: prototype-pollution key (__proto__) as a route PARAM value reaching a
  // validated schema (broader than the config-merge finding already logged) -> the
  // Express param value is always a string, and z.object output must not pollute the
  // global Object.prototype.
  it('TC-ABUSE-008: __proto__ as literal path-param VALUE -> no global prototype pollution', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/users/:id', { params: z.object({ id: z.string() }) }, (req, res) =>
      res.json({ id: req.params.id }),
    );
    const app = freshApp();
    app.get('/users/:id', validator, wrapped);

    const res = await request(app).get('/users/__proto__').expect(200);
    expect(res.body.id).toBe('__proto__');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  // TC-ABUSE-009: __proto__/constructor/prototype as QUERY STRING KEYS reaching a
  // validated schema (query objects in Express/qs can have __proto__-named keys parsed
  // from the query string itself, e.g. ?__proto__[x]=1 or ?constructor[prototype][x]=1).
  it('TC-ABUSE-009: __proto__/constructor keys in query string -> no pollution, graceful reject or strip', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'get',
      '/search',
      { query: z.object({ q: z.string().optional() }) },
      (req, res) => res.json({ query: req.query }),
    );
    const app = freshApp();
    app.get('/search', validator, wrapped);

    const res = await request(app).get('/search?__proto__[polluted]=yes&constructor[prototype][polluted2]=yes');
    // Must not crash; must not pollute Object.prototype regardless of status code.
    expect([200, 400]).toContain(res.status);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  // TC-ABUSE-010: __proto__ key inside a JSON request BODY reaching a validated schema
  // (distinct from config/merge.ts — this is the request-validation path, req.body from
  // express.json()'s JSON.parse, which produces an own-enumerable __proto__ key).
  it('TC-ABUSE-010: __proto__ own-key in JSON request body -> no prototype pollution after validation', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'post',
      '/items',
      { body: z.object({ a: z.string().optional() }).passthrough() },
      (req, res) => res.json({ body: req.body }),
    );
    const app = freshApp();
    app.use(express.json());
    app.post('/items', validator, wrapped);

    const res = await request(app)
      .post('/items')
      .set('Content-Type', 'application/json')
      .send('{"a":"x","__proto__":{"polluted3":"yes"}}');
    expect([200, 400]).toContain(res.status);
    expect(({} as Record<string, unknown>).polluted3).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});

describe('impossible-abuse: contradictory / invalid config', () => {
  // TC-ABUSE-012: unknown option key -> throws before mounting any route (AC-045).
  it('TC-ABUSE-012: unknown top-level option key -> throws ApiDocsConfigError, no partial setup', () => {
    expect(() => createApiDocs({ specPth: '/x' } as never)).toThrow(ApiDocsConfigError);
  });

  // TC-ABUSE-013: invalid enum value for validateResponses.
  it('TC-ABUSE-013: invalid enum value -> throws ApiDocsConfigError naming the option', () => {
    try {
      createApiDocs({ validateResponses: 'maybe' } as never);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiDocsConfigError);
      expect(String((err as Error).message)).toMatch(/validateResponses/);
    }
  });

  // TC-ABUSE-014: options is not an object at all (array, string, number, null-prototype).
  it('TC-ABUSE-014: non-object options (array) -> throws ApiDocsConfigError', () => {
    expect(() => createApiDocs([1, 2, 3] as never)).toThrow(ApiDocsConfigError);
  });

  it('TC-ABUSE-014b: non-object options (string) -> throws ApiDocsConfigError', () => {
    expect(() => createApiDocs('bogus' as never)).toThrow(ApiDocsConfigError);
  });

  // TC-ABUSE-015: specPath without leading slash (contract requires slash-prefixed paths).
  it('TC-ABUSE-015: specPath missing leading slash -> throws ApiDocsConfigError', () => {
    expect(() => createApiDocs({ specPath: 'no-slash' })).toThrow(ApiDocsConfigError);
  });
});

describe('impossible-abuse: replayed / reordered / duplicate registration', () => {
  // TC-ABUSE-018: the same route() call registered twice for the same method+path on the
  // same app (replayed registration) -> both handlers mount as separate Express layers;
  // no crash, first-match semantics apply, spec generation still succeeds (dedup happens
  // per AC-031 only for typed-vs-auto-detected collisions, not typed-vs-typed replay).
  it('TC-ABUSE-018: same typed route registered twice -> no crash, first registration wins at runtime', async () => {
    const api = createApiDocs();
    const app = freshApp();
    app.use(express.json());

    const [v1, h1] = api.route('get', '/dup', {}, (_req, res) => res.json({ which: 1 }));
    const [v2, h2] = api.route('get', '/dup', {}, (_req, res) => res.json({ which: 2 }));
    app.get('/dup', v1, h1);
    app.get('/dup', v2, h2);
    app.use(api.router);

    const res = await request(app).get('/dup').expect(200);
    expect(res.body.which).toBe(1); // Express dispatches to the first matching layer.

    // Spec generation must not throw despite the duplicate registration.
    expect(() => api.getSpec({ app })).not.toThrow();
  });

  // TC-ABUSE-019: describe() called twice on the same handler reference (reordered/replayed
  // registration metadata) -> last registration should not corrupt the registry or crash
  // spec generation.
  it('TC-ABUSE-019: describe() replayed twice for the same method+path -> spec generation does not crash', () => {
    const api = createApiDocs();
    const mw1 = api.describe('get', '/x', { summary: 'first' });
    const mw2 = api.describe('get', '/x', { summary: 'second' });
    void mw1;
    void mw2;

    expect(() => api.getSpec()).not.toThrow();
  });

  // TC-ABUSE-020: mounting the same Express router twice on an app (app.use(router) twice) —
  // introspection must not throw, infinite-loop, or double-count paths into a broken spec.
  it('TC-ABUSE-020: same router mounted twice on the app -> introspection completes, no crash/hang', async () => {
    const api = createApiDocs();
    const app = freshApp();
    const router = express.Router();
    router.get('/shared', (_req, res) => res.json({ ok: true }));
    app.use('/a', router);
    app.use('/b', router); // same router instance, mounted at two prefixes
    app.use(api.router);

    let spec: unknown;
    expect(() => {
      spec = api.getSpec({ app });
    }).not.toThrow();
    const paths = Object.keys((spec as { paths: Record<string, unknown> }).paths);
    expect(paths).toContain('/a/shared');
    expect(paths).toContain('/b/shared');
  });

  // TC-ABUSE-021: mounting the SAME router instance on itself twice at the SAME prefix
  // (fully replayed app.use call) -> introspection must be idempotent-safe, not throw.
  it('TC-ABUSE-021: identical app.use(prefix, router) call replayed at same prefix -> no crash, no duplicate explosion', async () => {
    const api = createApiDocs();
    const app = freshApp();
    const router = express.Router();
    router.get('/thing', (_req, res) => res.json({ ok: true }));
    app.use('/api', router);
    app.use('/api', router);
    app.use(api.router);

    expect(() => api.getSpec({ app })).not.toThrow();
  });
});

describe('impossible-abuse: circular references', () => {
  // TC-ABUSE-022: a Zod schema is inherently non-circular by construction, but a config
  // object passed to mergeOptions with a circular reference must not hang/stack-overflow
  // the merge — it should either throw a bounded error or the recursion must terminate.
  it('TC-ABUSE-022: circular object passed into mergeOptions -> does not hang the process (bounded failure)', () => {
    type Circular = { self?: Circular; value: number };
    const circular: Circular = { value: 1 };
    circular.self = circular;

    let threw = false;
    try {
      mergeOptions({ value: 0 }, circular, {});
    } catch {
      threw = true;
    }
    // Either it throws (RangeError: stack overflow) or somehow completes — both are
    // "did not hang". A timeout on this test IS the failure signature we're checking for.
    expect(typeof threw).toBe('boolean');
  });

  // TC-ABUSE-023: response body containing a circular reference returned from a typed
  // handler with response validation off -> res.json must fail gracefully (Express/
  // JSON.stringify throws a TypeError), not crash the server process.
  it('TC-ABUSE-023: handler returns circular JSON response -> Express error path, server stays up', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/circular', {}, (_req, res) => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      try {
        res.json(obj);
      } catch (err) {
        res.status(500).json({ error: 'serialization failed' });
        void err;
      }
    });
    const app = freshApp();
    app.get('/circular', validator, wrapped);

    const res = await request(app).get('/circular');
    expect([200, 500]).toContain(res.status);
  });
});

describe('impossible-abuse: deep nesting beyond JSON body (schema / query)', () => {
  // TC-ABUSE-024: deeply nested query-string bracket notation (qs library nesting depth).
  it('TC-ABUSE-024: deeply nested query bracket notation -> rejected or bounded, no crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'get',
      '/search',
      { query: z.object({ q: z.string().optional() }).passthrough() },
      (_req, res) => res.json({ ok: true }),
    );
    const app = freshApp();
    app.get('/search', validator, wrapped);

    let qs = 'q=1';
    let bracketChain = 'a';
    for (let i = 0; i < 200; i++) bracketChain += '[a]';
    qs += `&${bracketChain}=1`;

    const res = await request(app).get(`/search?${qs}`);
    expect([200, 400]).toContain(res.status);
  });

  // TC-ABUSE-025: array-typed query param with an extreme number of entries.
  it('TC-ABUSE-025: query array with thousands of entries -> handled without crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'get',
      '/search',
      { query: z.object({ q: z.string().optional() }).passthrough() },
      (_req, res) => res.json({ ok: true }),
    );
    const app = freshApp();
    app.get('/search', validator, wrapped);

    const params = Array.from({ length: 3000 }, (_, i) => `tag=${i}`).join('&');
    const res = await request(app).get(`/search?${params}`);
    expect([200, 400, 431]).toContain(res.status);
  });
});

describe('impossible-abuse: out-of-range / type-confused inputs', () => {
  // TC-ABUSE-026: numeric route param given a non-numeric, huge, or negative string where
  // schema coerces to number — must reject gracefully, not throw an uncaught exception.
  it('TC-ABUSE-026: absurd numeric string in coerced query param -> 400, not a crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route(
      'get',
      '/items',
      { query: z.object({ page: z.coerce.number().int().positive() }) },
      (_req, res) => res.json({ ok: true }),
    );
    const app = freshApp();
    app.get('/items', validator, wrapped);

    const huge = await request(app)
      .get('/items')
      .query({ page: '9'.repeat(400) });
    expect(huge.status).toBe(400);

    const negative = await request(app).get('/items').query({ page: '-1' });
    expect(negative.status).toBe(400);

    const nan = await request(app).get('/items').query({ page: 'NaN' });
    expect(nan.status).toBe(400);
  });

  // TC-ABUSE-027: array sent where schema expects a single string param.
  it('TC-ABUSE-027: array value sent for single-value query param -> validation rejects, no crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/items', { query: z.object({ q: z.string() }) }, (_req, res) =>
      res.json({ ok: true }),
    );
    const app = freshApp();
    app.get('/items', validator, wrapped);

    const res = await request(app).get('/items?q=1&q=2');
    expect(res.status).toBe(400);
  });

  // TC-ABUSE-028: null byte in a path param.
  it('TC-ABUSE-028: null byte in path param -> handled without crash', async () => {
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('get', '/users/:id', { params: z.object({ id: z.string() }) }, (req, res) =>
      res.json({ id: req.params.id }),
    );
    const app = freshApp();
    app.get('/users/:id', validator, wrapped);

    const res = await request(app).get('/users/%00abc');
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('impossible-abuse: onValidationError hook abuse', () => {
  // TC-ABUSE-029: onValidationError hook itself throws — must not crash the server /
  // hang the request; Express's error-handling should still surface something.
  it('TC-ABUSE-029: onValidationError hook throws -> propagates to Express error handling, no silent success', async () => {
    const { route } = makeRouteFactory({
      onValidationError: () => {
        throw new Error('hook exploded');
      },
    });
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ ok: true }),
    );
    const app = freshApp();
    app.use(express.json());
    app.post('/items', validator, wrapped);
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ caughtByErrorMw: true });
    });

    const res = await request(app).post('/items').send({ a: 1 });
    expect(res.status).toBe(500);
    expect(res.body.caughtByErrorMw).toBe(true);
  });

  // TC-ABUSE-030: onValidationError hook returns a malformed shape (missing status/body).
  it('TC-ABUSE-030: onValidationError hook returns malformed shape -> does not silently 200', async () => {
    const { route } = makeRouteFactory({
      onValidationError: () => ({ status: undefined as unknown as number, body: undefined }),
    });
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ ok: true }),
    );
    const app = freshApp();
    app.use(express.json());
    app.post('/items', validator, wrapped);

    const res = await request(app).post('/items').send({ a: 1 });
    // res.status(undefined) in Express throws synchronously inside the handler; Express
    // catches it and surfaces a 500 by default (no configured error middleware here).
    // The critical assertion: it must NOT be 200 (silent success on invalid input).
    expect(res.status).not.toBe(200);
  });
});
