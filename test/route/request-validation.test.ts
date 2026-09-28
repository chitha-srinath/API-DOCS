import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { majors } from '../fixtures/majors.js';
import { ApiDocsSchemaError } from '../../src/adapter/errors.js';
import { PROBLEM_CONTENT_TYPE } from '../../src/route/problem.js';
import type { TypedRequestHandler } from '../../src/route/typed.js';
import { makeRouteFactory } from './support.js';

type AnyTypedHandler = TypedRequestHandler<unknown, unknown, unknown>;

describe.each(majors)('route/request-validation (Express $major)', ({ express }) => {
  const makeApp = express as unknown as () => Express;
  const jsonMw = (): RequestHandler => (express as unknown as { json: () => RequestHandler }).json();

  it('AC-007: invalid body -> 400 problem+json, handler not called', async () => {
    const handler = vi.fn<AnyTypedHandler>((_req, res) => res.json({ ok: true }));
    const { route } = makeRouteFactory();
    const [validator, wrapped] = route('post', '/items', { body: z.object({ a: z.string() }) }, handler);
    const app = makeApp();
    app.use(jsonMw());
    app.post('/items', validator, wrapped);

    const res = await request(app).post('/items').send({ a: 1 }).expect(400);
    expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(res.body.type).toBeDefined();
    expect(res.body.title).toBeDefined();
    expect(res.body.status).toBe(400);
    expect(res.body.detail).toBeDefined();
    expect(Object.keys(res.body.errors[0]).sort()).toEqual(['in', 'message', 'path']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('AC-008: errors[].in is path/query/body respectively', async () => {
    const { route } = makeRouteFactory();
    const app = makeApp();
    app.use(jsonMw());

    const [pv, ph] = route('get', '/params/:id', { params: z.object({ id: z.string().min(5) }) }, (_req, res) =>
      res.json({}),
    );
    app.get('/params/:id', pv, ph);

    const [qv, qh] = route('get', '/query', { query: z.object({ n: z.coerce.number() }) }, (_req, res) => res.json({}));
    app.get('/query', qv, qh);

    const [bv, bh] = route('post', '/body', { body: z.object({ a: z.string() }) }, (_req, res) => res.json({}));
    app.post('/body', bv, bh);

    const pathRes = await request(app).get('/params/ab').expect(400);
    expect(pathRes.body.errors[0].in).toBe('path');

    const queryRes = await request(app).get('/query?n=notanumber').expect(400);
    expect(queryRes.body.errors[0].in).toBe('query');

    const bodyRes = await request(app).post('/body').send({ a: 1 }).expect(400);
    expect(bodyRes.body.errors[0].in).toBe('body');
  });

  it("AC-009: valid request gets coerced values, response is the handler's", async () => {
    const { route } = makeRouteFactory();
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('get', '/query2', { query: z.object({ n: z.coerce.number() }) }, (req, res) =>
      res.json({ n: req.query.n, kind: typeof req.query.n }),
    );
    app.get('/query2', validator, wrapped);

    const res = await request(app).get('/query2?n=5').expect(200);
    expect(res.body).toEqual({ n: 5, kind: 'number' });
  });

  it('AC-010/AC-040: global onValidationError replaces the default 400 body', async () => {
    const handler = vi.fn<AnyTypedHandler>((_req, res) => res.json({ ok: true }));
    const onValidationError = (): { status: number; body: unknown } => ({ status: 422, body: { custom: true } });
    const { route } = makeRouteFactory({ onValidationError });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('post', '/oe', { body: z.object({ a: z.string() }) }, handler);
    app.post('/oe', validator, wrapped);

    const res = await request(app).post('/oe').send({ a: 1 }).expect(422);
    expect(res.body).toEqual({ custom: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('AC-044d: per-route onValidationError beats global (global spy 0 calls)', async () => {
    const globalSpy = vi.fn(() => ({ status: 422, body: { from: 'global' } }));
    const routeHook = (): { status: number; body: unknown } => ({ status: 400, body: { from: 'route' } });
    const { route } = makeRouteFactory({ onValidationError: globalSpy });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route(
      'post',
      '/oe2',
      { body: z.object({ a: z.string() }), onValidationError: routeHook },
      (_req, res) => res.json({}),
    );
    app.post('/oe2', validator, wrapped);

    const res = await request(app).post('/oe2').send({ a: 1 }).expect(400);
    expect(res.body).toEqual({ from: 'route' });
    expect(globalSpy).not.toHaveBeenCalled();
  });

  it('AC-040: validateRequests:false lets an invalid request through, handler called once', async () => {
    const handler = vi.fn<AnyTypedHandler>((_req, res) => res.status(200).json({ ok: true }));
    const { route } = makeRouteFactory({ validateRequests: false });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('post', '/off', { body: z.object({ a: z.string() }) }, handler);
    app.post('/off', validator, wrapped);

    await request(app).post('/off').send({ a: 1 }).expect(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ADR-37: async refine -> 500 EAD_ASYNC_SCHEMA, handler 0 calls, no problem+json 400', async () => {
    const handler = vi.fn<AnyTypedHandler>((_req, res) => res.json({ ok: true }));
    const { route } = makeRouteFactory();
    const app = makeApp();
    app.use(jsonMw());
    const bodySchema = z.object({ a: z.string() }).refine(async () => true);
    const [validator, wrapped] = route('post', '/async', { body: bodySchema }, handler);
    let captured: unknown;
    app.post('/async', validator, wrapped);
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      captured = err;
      res.status(500).end();
    });

    const res = await request(app).post('/async').send({ a: 'ok' }).expect(500);
    expect(res.headers['content-type'] ?? '').not.toContain(PROBLEM_CONTENT_TYPE);
    expect(captured).toBeInstanceOf(ApiDocsSchemaError);
    expect((captured as ApiDocsSchemaError).code).toBe('EAD_ASYNC_SCHEMA');
    expect(handler).not.toHaveBeenCalled();
  });
});
