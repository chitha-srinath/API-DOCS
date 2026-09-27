import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { resolveOptions } from '../../src/config/validate.js';
import { buildSpec, detectOperations, selectOperations } from '../../src/spec/build.js';
import { createApiDocs } from '../../src/serve/router.js';
import { expectValidSpec } from '../fixtures/validate-spec.js';
import { majors, spyLogger } from '../fixtures/majors.js';
import { stub, stubAdapter } from '../fixtures/stub-adapter.js';

const securitySchemes = {
  bearer: { type: 'http' as const, scheme: 'bearer', bearerFormat: 'JWT' },
  apiKey: { type: 'apiKey' as const, name: 'X-API-Key', in: 'header' as const },
  oauth: {
    type: 'oauth2' as const,
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://a/auth',
        tokenUrl: 'https://a/token',
        scopes: { read: 'Read' },
      },
    },
  },
};

describe.each(majors)('spec generation on Express $major', ({ express, major }) => {
  it('AC-015/AC-016/AC-011: full typed route is valid OpenAPI 3.1', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use(api.router);
    app.put(
      '/users/:id',
      ...api.route(
        {
          summary: 'Update user',
          description: 'Replaces a user',
          deprecated: true,
          params: z.object({ id: z.string().describe('User id') }),
          query: z.object({ dryRun: z.coerce.boolean().optional(), limit: z.coerce.number() }),
          body: z.object({ name: z.string() }),
          responses: {
            200: z.object({ id: z.string(), name: z.string() }),
            404: { description: 'No such user', schema: z.object({ error: z.string() }) },
            204: { description: 'Nothing' },
          },
        },
        (_q, r) => r.end(),
      ),
    );
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.openapi).toMatch(/^3\.1\./);
    await expectValidSpec(res.body);
    const op = res.body.paths['/users/{id}'].put;
    expect(op.summary).toBe('Update user');
    expect(op.description).toBe('Replaces a user');
    expect(op.deprecated).toBe(true);
    expect(op.parameters).toEqual([
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'User id',
        schema: { type: 'string', description: 'User id' },
      },
      { name: 'dryRun', in: 'query', schema: { type: 'boolean' } },
      { name: 'limit', in: 'query', required: true, schema: { type: 'number' } },
    ]);
    expect(op.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        },
      },
    });
    expect(Object.keys(op.responses)).toEqual(['200', '204', '400', '404']);
    expect(op.responses['204']).toEqual({ description: 'Nothing' });
    expect(op.responses['404'].description).toBe('No such user');
    expect(op.responses['200'].content['application/json'].schema.required).toEqual(['id', 'name']);
    expect(op.responses['400']).toEqual({
      description: 'Bad Request',
      content: {
        'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
      },
    });
    expect(res.body.components.schemas.ProblemDetails.required).toEqual([
      'type',
      'title',
      'status',
      'detail',
    ]);
  });

  it('AC-011: a user-declared 400 is kept; routes without request schemas get no auto-400', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.post(
      '/a',
      ...api.route({ body: z.object({}), responses: { 400: { description: 'Mine' } } }, (_q, r) =>
        r.end(),
      ),
    );
    app.get('/b', ...api.route({ responses: { 200: z.string() } }, (_q, r) => r.end()));
    const spec = api.getSpec({ app });
    expect((spec.paths['/a']!.post!.responses as any)['400']).toEqual({ description: 'Mine' });
    expect(Object.keys(spec.paths['/b']!.get!.responses as object)).toEqual(['200']);
    expect(spec.components).toBeUndefined();
  });

  it('AC-017/AC-039: security schemes declared once; route and global requirements', async () => {
    const api = createApiDocs({ logger: spyLogger(), securitySchemes, security: [{ bearer: [] }] });
    const app = express();
    app.get('/inherit', ...api.route({}, (_q, r) => r.end()));
    app.get('/key', ...api.route({ security: [{ apiKey: [] }] }, (_q, r) => r.end()));
    app.get('/public', ...api.route({ security: [] }, (_q, r) => r.end()));
    app.get('/plain', (_q, r) => r.end());
    const spec = api.getSpec({ app });
    await expectValidSpec(spec);
    expect(Object.keys((spec.components as any).securitySchemes)).toEqual([
      'apiKey',
      'bearer',
      'oauth',
    ]);
    expect((spec.components as any).securitySchemes.oauth).toEqual(securitySchemes.oauth);
    expect(spec.paths['/inherit']!.get!.security).toEqual([{ bearer: [] }]);
    expect(spec.paths['/plain']!.get!.security).toEqual([{ bearer: [] }]);
    expect(spec.paths['/key']!.get!.security).toEqual([{ apiKey: [] }]);
    expect(spec.paths['/public']!.get!.security).toEqual([]);
  });

  it('no global security leaves operations without security', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get('/x', (_q, r) => r.end());
    expect(api.getSpec({ app }).paths['/x']!.get!.security).toBeUndefined();
  });

  it('AC-030: autoDetect false hides plain routes; exclude drops matching ones', () => {
    const app = express();
    app.get('/public', (_q, r) => r.end());
    app.get('/internal/metrics', (_q, r) => r.end());
    app.get('/internal', (_q, r) => r.end());
    const off = createApiDocs({ logger: spyLogger(), autoDetect: false });
    app.get('/typed', ...off.route({}, (_q, r) => r.end()));
    expect(Object.keys(off.getSpec({ app }).paths)).toEqual(['/typed']);
    const excluded = createApiDocs({
      logger: spyLogger(),
      autoDetect: { exclude: ['/internal/**'] },
    });
    expect(Object.keys(excluded.getSpec({ app }).paths)).toEqual(['/public', '/typed']);
  });

  it('AC-041: include plus a custom detectedDefaultResponse', () => {
    const api = createApiDocs({
      logger: spyLogger(),
      autoDetect: { include: ['/api/**'] },
      detectedDefaultResponse: { status: 204, description: 'No Content' },
    });
    const app = express();
    app.get('/api/a', (_q, r) => r.end());
    app.get('/api/b/c', (_q, r) => r.end());
    app.get('/other', (_q, r) => r.end());
    const spec = api.getSpec({ app });
    expect(Object.keys(spec.paths)).toEqual(['/api/a', '/api/b/c']);
    for (const path of ['/api/a', '/api/b/c']) {
      expect(spec.paths[path]!.get!.responses).toEqual({ '204': { description: 'No Content' } });
    }
  });

  it('AC-031: typed or describe() wins over a duplicate plain route', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get('/dup', (_q, r) => r.end());
    app.get('/dup', ...api.route({ summary: 'typed' }, (_q, r) => r.end()));
    app.post('/dup', api.describe({ summary: 'described' }), (_q, r) => r.end());
    app.post('/dup', (_q, r) => r.end());
    const spec = api.getSpec({ app });
    expect(Object.keys(spec.paths['/dup']!)).toEqual(['get', 'post']);
    expect(spec.paths['/dup']!.get!.summary).toBe('typed');
    expect(spec.paths['/dup']!.post!.summary).toBe('described');
  });

  it('AC-032: a route added after the spec router still appears on the next request', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use(api.router);
    app.get('/first', (_q, r) => r.end());
    const first = await request(app).get('/openapi.json');
    expect(Object.keys(first.body.paths)).toEqual(['/first']);
    const router = express.Router();
    app.use('/nested', router);
    router.get('/later', (_q, r) => r.end());
    const second = await request(app).get('/openapi.json');
    expect(Object.keys(second.body.paths)).toEqual(['/first', '/nested/later']);
  });

  it('AC-033: the spec and docs endpoints are not documented', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.use(api.router);
    app.get('/docs', (_q, r) => r.end());
    app.get('/x', (_q, r) => r.end());
    const res = await request(app).get('/openapi.json');
    expect(Object.keys(res.body.paths)).toEqual(['/x']);
  });

  it('AC-034: RegExp and unnamed wildcards are skipped with one debug line each; output is byte-stable', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    app.get(/^\/regex/, (_q, r) => r.end());
    if (major === 4) app.get('*', (_q, r) => r.end());
    else app.get('/*rest', (_q, r) => r.end());
    app.get('/ok/:id', (_q, r) => r.end());
    const first = JSON.stringify(api.getSpec({ app }));
    expect(logger.count('debug', 'EAD_ROUTE_SKIPPED')).toBe(major === 4 ? 2 : 1);
    api.invalidate();
    const second = JSON.stringify(api.getSpec({ app }));
    expect(second).toBe(first);
    const paths = Object.keys(JSON.parse(first).paths);
    expect(paths).toEqual(major === 4 ? ['/ok/{id}'] : ['/ok/{id}', '/{rest}']);
    if (major === 5) {
      expect(JSON.parse(first).paths['/{rest}'].get.parameters).toEqual([
        { name: 'rest', in: 'path', required: true, schema: { type: 'string' } },
      ]);
    }
    expect(logger.count('warn')).toBe(0);
  });

  it('A-2: optional segments produce two paths', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get(major === 4 ? '/opt/:id?' : '/opt{/:id}', (_q, r) => r.end());
    expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/opt', '/opt/{id}']);
  });

  it('AC-038: info, servers and tags overrides', async () => {
    const info = { title: 'Pets', version: '2.1.0', description: 'Pet store' };
    const servers = [{ url: 'https://api.example.com', description: 'prod' }];
    const tags = [{ name: 'pets', description: 'Pet ops' }];
    const api = createApiDocs({ logger: spyLogger(), openapi: { info, servers, tags } });
    const spec = api.getSpec({ app: express() });
    await expectValidSpec(spec);
    expect(spec.info).toEqual(info);
    expect(spec.servers).toEqual(servers);
    expect(spec.tags).toEqual(tags);
  });

  it('optional info fields are emitted when set', () => {
    const api = createApiDocs({
      logger: spyLogger(),
      openapi: {
        info: {
          summary: 's',
          termsOfService: 'https://t',
          contact: { email: 'a@b.c' },
          license: { name: 'MIT' },
        },
      },
    });
    expect(api.getSpec().info).toEqual({
      title: 'API',
      version: '0.0.0',
      summary: 's',
      termsOfService: 'https://t',
      contact: { email: 'a@b.c' },
      license: { name: 'MIT' },
    });
  });

  it('AC-042: default operationId/tags and custom strategies', () => {
    const app = express();
    const plain = express.Router();
    plain.get('/:id', (_q, r) => r.end());
    app.use('/users', plain);
    app.get('/', (_q, r) => r.end());
    const defaults = createApiDocs({ logger: spyLogger() });
    app.post('/users', ...defaults.route({}, (_q, r) => r.end()));
    const spec = defaults.getSpec({ app });
    expect(spec.paths['/users/{id}']!.get).toMatchObject({
      operationId: 'getUsersById',
      tags: ['users'],
    });
    expect(spec.paths['/users']!.post).toMatchObject({ operationId: 'postUsers', tags: ['users'] });
    expect(spec.paths['/']!.get!.operationId).toBe('getRoot');
    expect(spec.paths['/']!.get!.tags).toBeUndefined();

    const custom = createApiDocs({
      logger: spyLogger(),
      operationIdStrategy: (op) => `${op.source}_${op.method}_${op.expressPath}`,
      tagStrategy: (op) => [`tag:${op.path}`],
    });
    app.get(
      '/explicit',
      ...custom.route({ operationId: 'mine', tags: ['own'] }, (_q, r) => r.end()),
    );
    const customSpec = custom.getSpec({ app });
    expect(customSpec.paths['/users/{id}']!.get).toMatchObject({
      operationId: 'plain_get_/users/:id',
      tags: ['tag:/users/{id}'],
    });
    expect(customSpec.paths['/users']!.post).toMatchObject({
      operationId: 'typed_post_/users',
      tags: ['tag:/users'],
    });
    expect(customSpec.paths['/explicit']!.get).toMatchObject({
      operationId: 'mine',
      tags: ['own'],
    });
  });

  it('A-3: colliding operationIds get numeric suffixes', () => {
    const api = createApiDocs({ logger: spyLogger(), operationIdStrategy: () => 'same' });
    const app = express();
    app.get('/a', (_q, r) => r.end());
    app.get('/b', (_q, r) => r.end());
    app.get('/c', (_q, r) => r.end());
    const spec = api.getSpec({ app });
    expect(['/a', '/b', '/c'].map((p) => spec.paths[p]!.get!.operationId)).toEqual([
      'same',
      'same_2',
      'same_3',
    ]);
  });

  it('AC-044b: global tags apply unless the route declares its own', () => {
    const api = createApiDocs({ logger: spyLogger(), tags: ['a', 'b'] });
    const app = express();
    app.get('/g', (_q, r) => r.end());
    app.get('/r', ...api.route({ tags: ['c'] }, (_q, r) => r.end()));
    const spec = api.getSpec({ app });
    expect(spec.paths['/g']!.get!.tags).toEqual(['a', 'b']);
    expect(spec.paths['/r']!.get!.tags).toEqual(['c']);
  });

  it('AC-005: a non-Zod stub adapter validates and documents without core changes', async () => {
    const api = createApiDocs({ logger: spyLogger(), adapter: stubAdapter });
    const app = express();
    app.use(express.json());
    app.use(api.router);
    app.post(
      '/stub/:id',
      ...api.route(
        {
          params: stub({ id: 'number' }),
          body: stub({ name: 'string' }),
          responses: { 200: stub({ ok: 'string' }) },
        },
        (req, res) => res.json({ id: req.params, body: req.body }),
      ),
    );
    const bad = await request(app).post('/stub/x').send({});
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual([
      { in: 'path', path: 'id', message: 'expected number' },
      { in: 'body', path: 'name', message: 'expected string' },
    ]);
    const good = await request(app).post('/stub/4').send({ name: 'n' });
    expect(good.body).toEqual({ id: { id: 4 }, body: { name: 'n' } });
    const spec = (await request(app).get('/openapi.json')).body;
    await expectValidSpec(spec);
    expect(spec.paths['/stub/{id}'].post.parameters[0].schema).toEqual({ type: 'number' });
    expect(
      spec.paths['/stub/{id}'].post.requestBody.content['application/json'].schema.required,
    ).toEqual(['name']);
  });

  it('custom content types for bodies and responses', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.post(
      '/upload',
      ...api.route(
        {
          body: z.string(),
          bodyContentType: 'text/plain',
          responses: { 200: { schema: z.string(), contentType: 'text/csv' } },
        },
        (_q, r) => r.end(),
      ),
    );
    const op = api.getSpec({ app }).paths['/upload']!.post as any;
    expect(Object.keys(op.requestBody.content)).toEqual(['text/plain']);
    expect(Object.keys(op.responses['200'].content)).toEqual(['text/csv']);
  });

  it('non-object param schemas are warned about and not documented', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    app.get(
      '/q/:id',
      ...api.route({ params: z.string(), query: z.array(z.string()) }, (_q, r) => r.end()),
    );
    const op = api.getSpec({ app }).paths['/q/{id}']!.get as any;
    expect(op.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ]);
    expect(logger.count('warn', 'EAD_SCHEMA_NOT_OBJECT')).toBe(2);
  });

  it('unsupported plain path syntax is skipped with a warn', () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const root =
      major === 4 ? ((app as any).lazyrouter(), (app as any)._router) : (app as any).router;
    app.get('/ok', (_q, r) => r.end());
    root.stack.at(-1).route.path = '/bad(';
    expect(api.getSpec({ app }).paths).toEqual({});
    expect(logger.count('warn', 'EAD_ROUTE_SKIPPED')).toBe(1);
  });
});

describe('getSpec without an app', () => {
  it('returns typed routes at their declared local paths, without warnings', async () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    api.route({ method: 'get', path: '/users/:id', summary: 'declared' }, () => undefined);
    api.route({ summary: 'no path' }, () => undefined);
    api.describe({ method: 'delete', path: '/users/:id' });
    const spec = api.getSpec();
    await expectValidSpec(spec);
    expect(Object.keys(spec.paths)).toEqual(['/users/{id}']);
    expect(Object.keys(spec.paths['/users/{id}']!)).toEqual(['get', 'delete']);
    expect(logger.count('warn')).toBe(0);
  });

  it('warns about registry entries the walk could not find', () => {
    const { express } = majors[0]!;
    const logger = spyLogger();
    const api = createApiDocs({ logger });
    api.route({ method: 'get', path: '/declared' }, () => undefined);
    api.route({ summary: 'nowhere' }, () => undefined);
    const spec = api.getSpec({ app: express() });
    expect(Object.keys(spec.paths)).toEqual(['/declared']);
    expect(logger.count('warn', 'EAD_REGISTRY_UNLOCATED')).toBe(2);
  });

  it('returns a copy each time', () => {
    const api = createApiDocs({ logger: spyLogger() });
    const a = api.getSpec();
    a.info.title = 'mutated';
    expect(api.getSpec().info.title).toBe('API');
  });
});

describe('pure builder pieces', () => {
  const options = resolveOptions();
  it('detectOperations reports skipped routes once', () => {
    const logger = spyLogger();
    const ops = detectOperations({
      operations: [
        { method: 'get', expressPath: /x/, major: 5, source: 'plain' },
        { method: 'get', expressPath: /x/, major: 5, source: 'plain' },
      ],
      unlocated: [],
      walked: true,
      major: 5,
      options,
      adapter: standardSchemaAdapter,
      logger,
    });
    expect(ops).toEqual([]);
    expect(logger.count('debug')).toBe(1);
  });

  it('selectOperations keeps the first of equal rank and sorts by path then method', () => {
    const base = { expressPath: '', pathParams: [], order: 0 };
    const ops = selectOperations(
      [
        { ...base, method: 'post', path: '/b', source: 'plain' },
        { ...base, method: 'get', path: '/b', source: 'typed', meta: { summary: '1' } },
        { ...base, method: 'get', path: '/b', source: 'describe', meta: { summary: '2' } },
        { ...base, method: 'get', path: '/a', source: 'plain' },
      ],
      options,
    );
    expect(ops.map((o) => `${o.method} ${o.path} ${o.meta?.summary ?? ''}`)).toEqual([
      'get /a ',
      'get /b 1',
      'post /b ',
    ]);
  });

  it('buildSpec is deterministic for the same input', () => {
    const input = {
      operations: [
        { method: 'get' as const, expressPath: '/z', major: 5 as const, source: 'plain' as const },
      ],
      unlocated: [],
      walked: true,
      major: 5 as const,
      options,
      adapter: standardSchemaAdapter,
      logger: spyLogger(),
    };
    expect(JSON.stringify(buildSpec(input))).toBe(JSON.stringify(buildSpec(input)));
  });
});
