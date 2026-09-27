import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('request validation on Express $major', ({ express }) => {
  function setup(options: Parameters<typeof createApiDocs>[0] = {}, routeOptions: object = {}) {
    const logger = spyLogger();
    const api = createApiDocs({ logger, ...options });
    const handler = vi.fn((req: any, res: any) => {
      res.json({ params: req.params, query: req.query, body: req.body });
    });
    const app = express();
    app.use(express.json());
    app.post(
      '/users/:id',
      ...api.route(
        {
          params: z.object({ id: z.coerce.number().int() }),
          query: z.object({ limit: z.coerce.number().max(10).optional() }),
          body: z.object({ name: z.string() }),
          ...routeOptions,
        },
        handler,
      ),
    );
    return { app, handler, logger };
  }

  it('AC-007: invalid body gives 400 problem+json and the handler is not called', async () => {
    const { app, handler } = setup();
    const res = await request(app).post('/users/1').send({ name: 5 });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Request validation failed with 1 issue.',
      errors: [{ in: 'body', path: 'name', message: expect.any(String) }],
    });
    expect(Object.keys(res.body.errors[0]).sort()).toEqual(['in', 'message', 'path']);
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it.each([
    ['/users/abc', { name: 'a' }, 'path', 'id'],
    ['/users/1?limit=50', { name: 'a' }, 'query', 'limit'],
    ['/users/1', {}, 'body', 'name'],
  ])('AC-008: %s -> errors[].in = %s', async (url, body, location, path) => {
    const { app } = setup();
    const res = await request(app).post(url).send(body);
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].in).toBe(location);
    expect(res.body.errors[0].path).toBe(path);
  });

  it('collects issues from every location', async () => {
    const { app } = setup();
    const res = await request(app).post('/users/x?limit=99').send({});
    expect(res.body.errors.map((e: { in: string }) => e.in)).toEqual(['path', 'query', 'body']);
    expect(res.body.detail).toBe('Request validation failed with 3 issues.');
  });

  it('AC-009: valid request gets coerced values and the handler response', async () => {
    const { app, handler } = setup();
    const res = await request(app).post('/users/7?limit=5').send({ name: 'ada' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 7 }, query: { limit: 5 }, body: { name: 'ada' } });
    expect(handler).toHaveBeenCalledTimes(1);
    const req = handler.mock.calls[0]![0];
    expect(req.params.id).toBe(7);
    expect(req.query.limit).toBe(5);
  });

  it('AC-010/AC-040: global onValidationError replaces the default body', async () => {
    const hook = vi.fn(() => ({ status: 422, body: { custom: true } }));
    const { app } = setup({ onValidationError: hook });
    const res = await request(app).post('/users/1').send({});
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ custom: true });
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(hook).toHaveBeenCalledTimes(1);
    expect((hook.mock.calls[0] as unknown[])[0]).toEqual([
      { in: 'body', path: 'name', message: expect.any(String) },
    ]);
  });

  it('onValidationError can send text with a custom content type', async () => {
    const { app } = setup({
      onValidationError: () => ({ status: 418, body: 'nope', contentType: 'text/plain' }),
    });
    const res = await request(app).post('/users/1').send({});
    expect(res.status).toBe(418);
    expect(res.text).toBe('nope');
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
  });

  it('AC-044d: per-route onValidationError beats the global one', async () => {
    const globalHook = vi.fn(() => ({ status: 422, body: 'global' }));
    const routeHook = vi.fn(() => ({ status: 409, body: { route: true } }));
    const { app } = setup({ onValidationError: globalHook }, { onValidationError: routeHook });
    const res = await request(app).post('/users/1').send({});
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ route: true });
    expect(globalHook).toHaveBeenCalledTimes(0);
  });

  it('AC-040: validateRequests false calls the handler with raw values', async () => {
    const { app, handler } = setup({ validateRequests: false });
    const res = await request(app).post('/users/abc').send({ name: 5 });
    expect(res.status).toBe(200);
    expect(res.body.params).toEqual({ id: 'abc' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('per-route validateRequests false overrides the global default', async () => {
    const { app } = setup({}, { validateRequests: false });
    expect((await request(app).post('/users/abc').send({})).status).toBe(200);
  });

  it('validates headers without replacing them', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get(
      '/h',
      ...api.route({ headers: z.object({ 'x-token': z.string().min(3) }) }, (req: any, res: any) =>
        res.json({ token: req.headers['x-token'] }),
      ),
    );
    const bad = await request(app).get('/h').set('x-token', 'a');
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0]).toMatchObject({ in: 'header', path: 'x-token' });
    const good = await request(app).get('/h').set('x-token', 'abcd');
    expect(good.body).toEqual({ token: 'abcd' });
  });

  it('a route without request schemas passes straight through', async () => {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    app.get('/free', ...api.route({ summary: 'free' }, (_req, res) => res.json({ ok: true })));
    expect((await request(app).get('/free')).body).toEqual({ ok: true });
  });

  it('a throwing adapter reaches the error middleware', async () => {
    const api = createApiDocs({
      logger: spyLogger(),
      adapter: {
        name: 'broken',
        isSchema: () => true,
        validate: () => {
          throw new Error('adapter broke');
        },
        toJSONSchema: () => ({}),
      },
    });
    const app = express();
    app.get('/x', ...api.route({ query: {} }, (_req, res) => res.send('no')));
    app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).send(err.message));
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.text).toBe('adapter broke');
  });
});
