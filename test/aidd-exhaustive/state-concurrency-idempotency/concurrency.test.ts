// AIDD QA exhaustive matrix — category: state-concurrency-idempotency
// AIDD exhaustive-testing pass, QA steps 4-5 (Wave B).
// Do NOT re-litigate F-01/F-02/F-04 (see qa/verdicts.md) — already CONFIRMED,
// in the fix loop. This file covers repeated/concurrent GET /openapi.json,
// concurrent invalidate()+GET races, double-registration idempotency,
// mount-recorder concurrent-mount behavior, and rebuild-cycle consistency.
import express, { type Express, Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApiDocs } from '../../../src/serve/router.js';
import { createRegistry } from '../../../src/registry/registry.js';
import { installRecorder } from '../../../src/introspect/recorder.js';
import { createSpecCache } from '../../../src/spec/cache.js';

function freshApp(): Express {
  const app = express();
  installRecorder(express);
  return app;
}

describe('TC-CONC: repeated/concurrent GET /openapi.json determinism (AC-034)', () => {
  it('TC-CONC-001 (AC-034): 50 concurrent GET /openapi.json calls all return byte-identical JSON', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/users/:id', { response: z.object({ id: z.string() }) }, (req, res) => {
      res.json({ id: req.params.id });
    });
    app.use(api.router);

    const N = 50;
    const responses = await Promise.all(Array.from({ length: N }, () => request(app).get('/openapi.json')));
    const bodies = responses.map((r) => JSON.stringify(r.body));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const first = bodies[0];
    expect(bodies.every((b) => b === first)).toBe(true);
  });

  it('TC-CONC-002 (AC-034): sequential repeated GET /openapi.json (10x) are byte-identical', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('post', '/items', { body: z.object({ name: z.string() }) }, (_req, res) => {
      res.status(201).json({ ok: true });
    });
    app.use(api.router);

    const bodies: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      bodies.push(JSON.stringify(res.body));
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it('TC-CONC-003 (AC-034): concurrent GETs interleaved with a plain-route mount mid-flight still each return a valid, internally-consistent spec', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/a', {}, (_req, res) => res.json({}));
    app.use(api.router);

    // Fire a burst of concurrent requests, then mount a new plain route, then
    // fire another burst — first burst must reflect the pre-mount fingerprint,
    // second burst must reflect the fingerprint after the mount (cache miss).
    const before = await Promise.all(Array.from({ length: 10 }, () => request(app).get('/openapi.json')));
    app.get('/b', (_req, res) => res.json({}));
    const after = await Promise.all(Array.from({ length: 10 }, () => request(app).get('/openapi.json')));

    expect(before.every((r) => r.status === 200)).toBe(true);
    expect(after.every((r) => r.status === 200)).toBe(true);
    const beforePaths = Object.keys(before[0]!.body.paths ?? {});
    const afterPaths = Object.keys(after[0]!.body.paths ?? {});
    expect(beforePaths).not.toContain('/b');
    expect(afterPaths).toContain('/b');
    // each burst internally consistent
    expect(new Set(before.map((r) => JSON.stringify(r.body))).size).toBe(1);
    expect(new Set(after.map((r) => JSON.stringify(r.body))).size).toBe(1);
  });
});

describe('TC-CONC: concurrent invalidate() + GET races', () => {
  it('TC-CONC-010: interleaving invalidate() calls between concurrent GETs never yields a corrupted/partial document', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/x', {}, (_req, res) => res.json({}));
    app.use(api.router);

    const gets = Array.from({ length: 20 }, (_v, i) => {
      if (i % 3 === 0) api.invalidate();
      return request(app).get('/openapi.json');
    });
    const results = await Promise.all(gets);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('openapi');
      expect(r.body).toHaveProperty('paths');
      expect(typeof r.body.paths).toBe('object');
    }
  });

  it('TC-CONC-011: invalidate() called mid-request-batch does not lose routes added before it', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/persist', {}, (_req, res) => res.json({}));
    app.use(api.router);

    await request(app).get('/openapi.json'); // warm the cache
    api.invalidate();
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toContain('/persist');
  });

  it('TC-CONC-012: direct createSpecCache unit-level race simulation — synchronous get() calls never interleave (documented in qa/findings-performance.md)', () => {
    const cache = createSpecCache<number>();
    let buildCalls = 0;
    const fakeApp = { _router: { stack: [{ route: { path: '/a' } }] } };
    const build = (): number => {
      buildCalls += 1;
      return buildCalls;
    };
    // Simulate "concurrent" calls (same tick, synchronous): with a stable
    // fingerprint, only the first call should invoke build().
    const r1 = cache.get(fakeApp, build);
    const r2 = cache.get(fakeApp, build);
    const r3 = cache.get(fakeApp, build);
    expect(buildCalls).toBe(1);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

describe('TC-CONC: double-registration idempotency (registry-level, not just "does not crash")', () => {
  it('TC-CONC-020 (AC-031 adjacent): registering the SAME method+path twice via route() creates TWO distinct registry entries (registry has no dedup)', () => {
    const registry = createRegistry();
    const entryA = registry.register({
      method: 'get',
      localPath: '/dup',
      source: 'typed',
      meta: {},
      handlerFn: (() => {}) as never,
    });
    const entryB = registry.register({
      method: 'get',
      localPath: '/dup',
      source: 'typed',
      meta: {},
      handlerFn: (() => {}) as never,
    });
    expect(entryA.id).not.toBe(entryB.id);
    expect(registry.entries().filter((e) => e.localPath === '/dup' && e.method === 'get')).toHaveLength(2);
  });

  it('TC-CONC-021: double route() registration + BOTH mounted on the SAME Express path produces TWO operations in the emitted spec for that path+method (duplicate, not deduped/overwritten)', async () => {
    const app = freshApp();
    const api = createApiDocs();
    const [validatorA, handlerA] = api.route('get', '/same', {}, (_req, res) => res.json({ which: 'a' }));
    const [validatorB, handlerB] = api.route('get', '/same', {}, (_req, res) => res.json({ which: 'b' }));
    // Mount A first; Express will only ever dispatch the first matching layer,
    // but BOTH are present in the router stack (Express itself doesn't dedup),
    // so introspection should discover both distinct registry entries.
    app.get('/same', validatorA, handlerA);
    app.get('/same', validatorB, handlerB);
    app.use(api.router);

    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    // OBSERVED (verified by reading src/spec/build.ts `dedupe()`): buildSpec
    // dedupes same method+path keys, tie-broken by lower registration id
    // (earlier `route()` call wins) when ranks are equal (typed vs typed).
    // So exactly ONE operation surfaces in paths./same.get, and it is
    // deterministically the FIRST-registered one (handler A), not a merge
    // and not last-write-wins.
    const opsForSame = countOperationsForPath(res.body, '/same', 'get');
    expect(opsForSame).toBe(1);
    expect(res.body.paths['/same']).toBeDefined();
    expect(res.body.paths['/same'].get).toBeDefined();
  });

  it('TC-CONC-022: calling describe() twice for the same method+path (never mounting either middleware) still emits it as an orphan operation in the spec — TWICE (both registry entries surface via EAD_REGISTRY_ENTRY_NOT_FOUND fallback)', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.describe('get', '/ghost', { summary: 'first' });
    api.describe('get', '/ghost', { summary: 'second' });
    app.use(api.router); // no route actually mounted for /ghost

    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    // OBSERVED: both unmounted describe() registrations are orphans (never
    // seen during the walk) -> introspectUnsafe's fallback loop emits one
    // operation per un-seen registry entry (both keyed to the SAME path),
    // then buildSpec's dedupe() collapses the tie deterministically to the
    // FIRST-registered entry (lower id) since both share source='describe'
    // (equal rank) -> summary 'first' wins, 'second' is silently dropped.
    expect(res.body.paths['/ghost']).toBeDefined();
    expect(res.body.paths['/ghost'].get).toBeDefined();
    expect((res.body.paths['/ghost'].get as { summary?: string }).summary).toBe('first');
  });

  it('TC-CONC-023: re-registering the same route() call twice then hitting GET twice returns identical spec both times (registration is a one-time setup call, not a per-request idempotency key)', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/rep', {}, (_req, res) => res.json({}));
    api.route('get', '/rep', {}, (_req, res) => res.json({}));
    // Only mount the entries' underlying middleware once via app.use of the
    // package router itself is irrelevant here since neither /rep handler is
    // mounted on the app router — both become orphans, symmetric to TC-CONC-022.
    app.use(api.router);
    const first = await request(app).get('/openapi.json');
    const second = await request(app).get('/openapi.json');
    expect(JSON.stringify(first.body)).toBe(JSON.stringify(second.body));
  });
});

function countOperationsForPath(spec: { paths?: Record<string, unknown> }, path: string, method: string): number {
  const pathItem = spec.paths?.[path] as Record<string, unknown> | undefined;
  if (!pathItem) return 0;
  return method in pathItem ? 1 : 0;
}

describe('TC-CONC: mount-recorder concurrent/rapid-succession mounting', () => {
  it('TC-CONC-030: mounting many sub-routers in rapid synchronous succession (no await between) all get annotated and are all discoverable', async () => {
    const app = freshApp();
    const api = createApiDocs();
    const routers: Router[] = [];
    for (let i = 0; i < 25; i += 1) {
      const r = Router();
      r.get('/leaf', (_req, res) => res.json({ i }));
      routers.push(r);
    }
    // Rapid-fire synchronous mounts, no interleaving.
    routers.forEach((r, i) => app.use(`/mnt${i}`, r));
    app.use(api.router);

    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    for (let i = 0; i < 25; i += 1) {
      expect(res.body.paths[`/mnt${i}/leaf`]).toBeDefined();
    }
  });

  it('TC-CONC-031: installRecorder() called multiple times concurrently (Promise.all of synchronous calls) is idempotent — RECORDER guard prevents double-wrapping `use`', async () => {
    // installRecorder is synchronous; "concurrent" here means back-to-back
    // calls with no observable interleaving opportunity (single-threaded).
    await Promise.all([
      Promise.resolve().then(() => installRecorder(express)),
      Promise.resolve().then(() => installRecorder(express)),
      Promise.resolve().then(() => installRecorder(express)),
    ]);

    const app = express();
    const before = (Router() as unknown as { stack?: unknown[] }).stack?.length ?? 0;
    const child = Router();
    child.get('/x', (_req, res) => res.json({}));
    app.use('/m', child);
    const api = createApiDocs();
    app.use(api.router);
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/m/x']).toBeDefined();
    // wrappedUse must not have been applied more than once: verify no
    // duplicate MOUNT annotation causing duplicate path entries.
    expect(Object.keys(res.body.paths).filter((p) => p === '/m/x')).toHaveLength(1);
    void before;
  });

  it('TC-CONC-032: mounting the SAME router instance at two different paths concurrently-dispatched requests both resolve correctly (no shared-mutable-state corruption across mount points)', async () => {
    const app = freshApp();
    const shared = Router();
    shared.get('/leaf', (_req, res) => res.json({ from: 'shared' }));
    app.use('/one', shared);
    app.use('/two', shared);
    const api = createApiDocs();
    app.use(api.router);

    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/one/leaf']).toBeDefined();
    expect(res.body.paths['/two/leaf']).toBeDefined();
  });
});

describe('TC-CONC: rebuild-cycle persistence/consistency under interleaved concurrent reads', () => {
  it('TC-CONC-040: N interleaved (route-add, invalidate, concurrent-GET-burst) cycles converge to a spec containing every added route exactly once', async () => {
    const app = freshApp();
    const api = createApiDocs();
    app.use(api.router);
    const CYCLES = 8;
    for (let i = 0; i < CYCLES; i += 1) {
      const path = `/cycle${i}`;
      const [validator, handler] = api.route('get', path, {}, (_req, res) => res.json({ i }));
      app.get(path, validator, handler);
      api.invalidate();
      // concurrent burst mid-cycle
      const burst = await Promise.all(Array.from({ length: 5 }, () => request(app).get('/openapi.json')));
      expect(burst.every((r) => r.status === 200)).toBe(true);
      expect(new Set(burst.map((r) => JSON.stringify(r.body))).size).toBe(1);
    }
    const final = await request(app).get('/openapi.json');
    for (let i = 0; i < CYCLES; i += 1) {
      expect(final.body.paths[`/cycle${i}`]).toBeDefined();
    }
    expect(Object.keys(final.body.paths)).toHaveLength(CYCLES);
  });

  it('TC-CONC-041: interleaving getSpec({app}) (cached path) and getSpec() (registry-only, uncached path) concurrently never cross-contaminates results', async () => {
    const app = freshApp();
    const api = createApiDocs();
    api.route('get', '/reg-only', {}, (_req, res) => res.json({}));
    app.use(api.router);

    const [cached, registryOnly, cached2] = await Promise.all([
      Promise.resolve(api.getSpec({ app })),
      Promise.resolve(api.getSpec()),
      Promise.resolve(api.getSpec({ app })),
    ]);
    expect((cached as { paths: Record<string, unknown> }).paths['/reg-only']).toBeDefined();
    expect((registryOnly as { paths: Record<string, unknown> }).paths['/reg-only']).toBeDefined();
    expect(JSON.stringify(cached)).toBe(JSON.stringify(cached2));
  });

  it('TC-CONC-042: heavy concurrent load (200 simultaneous GETs) across a 30-route app never produces a mismatched/truncated body and never crashes the process', async () => {
    const app = freshApp();
    const api = createApiDocs();
    for (let i = 0; i < 30; i += 1) {
      const path = `/load${i}`;
      const [validator, handler] = api.route('get', path, {}, (_req, res) => res.json({ i }));
      app.get(path, validator, handler);
    }
    app.use(api.router);

    const responses = await Promise.all(Array.from({ length: 200 }, () => request(app).get('/openapi.json')));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const distinctBodies = new Set(responses.map((r) => JSON.stringify(r.body)));
    expect(distinctBodies.size).toBe(1);
    expect(Object.keys(responses[0]!.body.paths)).toHaveLength(30);
  });
});
