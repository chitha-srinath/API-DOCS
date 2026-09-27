import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CHILD, META, MOUNT } from '../../src/core/types.js';
import { fingerprint, introspect, markInternal, topApp } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { createApiDocs } from '../../src/serve/router.js';
import { expectValidSpec } from '../fixtures/validate-spec.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('route auto-detection on Express $major', ({ express, major }) => {
  it('AC-023: nested router plain routes get the full path, params, 200 and tag', async () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const router = express.Router();
    router.get('/users/:id', (_req, res) => res.send('get'));
    router.post('/users/:id', (_req, res) => res.send('post'));
    app.use('/api', router);
    app.use(api.router);

    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    const spec = res.body;
    await expectValidSpec(spec);
    expect(Object.keys(spec.paths)).toEqual(['/api/users/{id}']);
    const item = spec.paths['/api/users/{id}'];
    expect(Object.keys(item)).toEqual(['get', 'post']);
    for (const method of ['get', 'post']) {
      expect(item[method]).toEqual({
        operationId: `${method}ApiUsersById`,
        tags: ['api'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      });
    }
    expect(logger.count('warn')).toBe(0);
  });

  it('documents typed routes on a router mounted after declaration, sub-apps and wrapped handlers', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const router = express.Router();
    router.get(
      '/users/:id',
      ...api.route({ summary: 'nested', params: z.object({ id: z.string() }) }, (_q, r) => r.end()),
    );
    app.use('/api', router);

    const sub = express();
    sub.get('/items/:id', ...api.route({ summary: 'subapp' }, (_q, r) => r.end()));
    app.use('/v1', sub);

    const [validator, handler] = api.route({ summary: 'wrapped' }, (_q, r) => r.end());
    const wrap = (fn: any) => (req: any, res: any, next: any) => fn(req, res, next);
    app.get('/w', wrap(validator), handler);
    app.get('/plain', (_q, r) => r.end());

    const spec = api.getSpec({ app });
    expect(spec.paths['/api/users/{id}']!.get!.summary).toBe('nested');
    expect(spec.paths['/v1/items/{id}']!.get!.summary).toBe('subapp');
    expect(spec.paths['/w']!.get!.summary).toBe('wrapped');
    expect(spec.paths['/plain']!.get!.summary).toBeUndefined();
    expect(logger.count('warn')).toBe(0);
  });

  it('describe() documents without validating (AC-022)', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use(express.json());
    app.post(
      '/legacy',
      api.describe({
        summary: 'Legacy',
        body: z.object({ n: z.number() }),
        responses: { 201: { description: 'Made' } },
      }),
      (req, res) => res.status(201).json(req.body),
    );
    const res = await request(app).post('/legacy').send({ n: 'not a number' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ n: 'not a number' });
    const op = api.getSpec({ app }).paths['/legacy']!.post!;
    expect(op.summary).toBe('Legacy');
    expect(op.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
        },
      },
    });
    expect(Object.keys(op.responses as object)).toEqual(['201']);
  });

  it('describe() with no arguments documents a plain route with defaults', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get('/d', api.describe(), (_q, r) => r.end());
    expect(api.getSpec({ app }).paths['/d']!.get!.responses).toEqual({
      '200': { description: 'OK' },
    });
  });

  it('routes with several methods, route() chains and array paths', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app
      .route('/multi')
      .get((_q, r) => r.end())
      .put((_q, r) => r.end());
    app.get(['/one', '/two'], (_q, r) => r.end());
    app.all('/any', (_q, r) => r.end());
    const spec = api.getSpec({ app });
    expect(Object.keys(spec.paths['/multi']!)).toEqual(['get', 'put']);
    expect(spec.paths['/one']!.get).toBeDefined();
    expect(spec.paths['/two']!.get).toBeDefined();
    // Express itself expands app.all() into one route entry per method.
    expect(Object.keys(spec.paths['/any']!)).toEqual(
      expect.arrayContaining(['get', 'post', 'delete']),
    );
  });

  it('walks from the top-level app when the docs router is inside a sub-app', async () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    app.get('/top', (_q, r) => r.end());
    const sub = express();
    sub.use(api.router);
    app.use('/meta', sub);
    const res = await request(app).get('/meta/openapi.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(['/top']);
    expect(logger.count('warn', 'EAD_MOUNTED_IN_SUBAPP')).toBeGreaterThanOrEqual(1);
  });

  it('mounts with an array of paths and parameterised mounts', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    const router = express.Router();
    router.get('/x', (_q, r) => r.end());
    app.use(['/a', '/b'], router);
    const org = express.Router();
    org.get('/repos', (_q, r) => r.end());
    app.use('/orgs/:org', org);
    const spec = api.getSpec({ app });
    expect(Object.keys(spec.paths)).toEqual(['/a/x', '/b/x', '/orgs/{org}/repos']);
  });

  it('a RegExp mount warns and falls back to the local path', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const router = express.Router();
    router.get('/x', (_q, r) => r.end());
    app.use(/^\/re/, router);
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/x']);
    expect(logger.count('warn', 'EAD_MOUNT_UNRECOVERABLE')).toBe(1);
  });

  it('a router mounted twice is documented under both paths', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    const router = express.Router();
    router.get('/x', (_q, r) => r.end());
    app.use('/a', router);
    app.use('/b', router);
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/a/x', '/b/x']);
  });

  it.skipIf(major !== 4)(
    'Express 4 recovers prefixes from layer.regexp for unrecorded mounts',
    () => {
      const logger = spyLogger();
      const api = createApiDocs({ logger });
      const app = express();
      const router = express.Router();
      router.get('/x', (_q, r) => r.end());
      app.use('/legacy', router);
      const layer = (app as any)._router.stack.at(-1);
      delete layer[MOUNT];
      expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/legacy/x']);
      expect(logger.count('warn')).toBe(0);
    },
  );

  it.skipIf(major !== 5)('Express 5 unrecorded mounts use the local path and warn', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const router = express.Router();
    router.get('/x', (_q, r) => r.end());
    app.use('/lost', router);
    const layer = (app as any).router.stack.at(-1);
    delete layer[MOUNT];
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/x']);
    expect(logger.count('warn', 'EAD_MOUNT_UNRECOVERABLE')).toBe(1);
  });

  it('an unrecorded sub-app warns once', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const sub = express();
    sub.get('/hidden', (_q, r) => r.end());
    app.use('/sub', sub);
    const root = major === 4 ? (app as any)._router : (app as any).router;
    const layer = root.stack.at(-1);
    delete layer[CHILD];
    delete layer[MOUNT];
    expect(api.getSpec({ app }).paths).toEqual({});
    expect(logger.count('warn', 'EAD_SUBAPP_UNRECORDED')).toBe(1);
  });

  it('a layer that throws while inspected is skipped with a warn', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    app.get('/ok', (_q, r) => r.end());
    const root = major === 4 ? (app as any)._router : (app as any).router;
    const bad = {};
    Object.defineProperty(bad, 'route', {
      get() {
        throw new Error('boom');
      },
    });
    root.stack.push(bad);
    root.stack.push(null);
    root.stack.push({ name: 'odd', handle: 5 });
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/ok']);
    expect(logger.count('warn', 'EAD_LAYER_THREW')).toBe(1);
    expect(logger.count('warn', 'EAD_LAYER_UNRECOGNISED')).toBe(2);
  });

  it('routes of another instance keep their metadata (META as secondary key)', () => {
    const a = createApiDocs({ logger: spyLogger() });
    const b = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get('/from-a', ...a.route({ summary: 'A' }, (_q, r) => r.end()));
    expect(b.getSpec({ app }).paths['/from-a']!.get!.summary).toBe('A');
  });

  it('never documents its own endpoints, even under a prefix', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use('/meta', api.router);
    app.get('/openapi.json', (_q, r) => r.end());
    expect(api.getSpec({ app }).paths).toEqual({});
  });
});

describe('introspect helpers', () => {
  it('handles a missing app and apps without a router', () => {
    const registry = createRegistry();
    const logger = spyLogger();
    expect(introspect(undefined, registry, logger)).toEqual({ operations: [], unlocated: [] });
    const fake = Object.assign(() => undefined, {
      use() {},
      handle() {},
      set() {},
      router: undefined,
    });
    expect(introspect(fake as never, registry, logger).operations).toEqual([]);
  });

  it('never throws even when the app itself throws', () => {
    const logger = spyLogger();
    const app = Object.assign(() => undefined, { use() {}, handle() {}, set() {} });
    Object.defineProperty(app, 'router', {
      get() {
        throw new Error('nope');
      },
    });
    expect(introspect(app as never, createRegistry(), logger).operations).toEqual([]);
    expect(logger.count('warn', 'EAD_LAYER_THREW')).toBe(1);
    expect(fingerprint(app as never)).toBe(0);
  });

  it('topApp climbs to the root app', () => {
    const logger = spyLogger();
    const root = Object.assign(() => undefined, { handle() {}, set() {} });
    const child = { parent: root };
    expect(topApp(child as never, logger)).toBe(root);
    expect(topApp(root as never, logger)).toBe(root);
  });

  it('markInternal tags a handler', () => {
    const fn = () => undefined;
    markInternal(fn);
    expect((fn as any)[META]).toEqual({ internal: true });
  });

  it.each(majors)(
    'fingerprint changes when nested routes are added (Express $major)',
    ({ express }) => {
      const app = express();
      const router = express.Router();
      app.use('/api', router);
      const sub = express();
      app.use('/sub', sub);
      const before = fingerprint(app as never);
      router.get('/new', (_q, r) => r.end());
      const afterRouter = fingerprint(app as never);
      expect(afterRouter).toBeGreaterThan(before);
      sub.get('/deep', (_q, r) => r.end());
      expect(fingerprint(app as never)).toBeGreaterThan(afterRouter);
    },
  );
});

describe('cycle guard', () => {
  it('a router mounted inside itself does not loop forever', () => {
    const { express } = majors[0]!;
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    const router = express.Router();
    router.get('/x', (_q, r) => r.end());
    router.use('/again', router);
    app.use('/r', router);
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/r/x']);
  });
});
