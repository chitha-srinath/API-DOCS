import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { majors } from '../fixtures/majors.js';
import { createLoggerSpy, makeRouteFactory } from './support.js';

describe.each(majors)('route/response-validation (Express $major)', ({ express }) => {
  const makeApp = express as unknown as () => Express;
  const jsonMw = (): RequestHandler => (express as unknown as { json: () => RequestHandler }).json();

  it('AC-012: validateResponses unset -> unchanged body, silent logger', async () => {
    const logger = createLoggerSpy();
    const { route } = makeRouteFactory({}, logger);
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('get', '/unset', { response: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ a: 1 }),
    );
    app.get('/unset', validator, wrapped);

    const res = await request(app).get('/unset').expect(200);
    expect(res.body).toEqual({ a: 1 });
    expect(logger.warnCalls).toHaveLength(0);
    expect(logger.debugCalls).toHaveLength(0);
  });

  it('ADR-03: validateResponses:false -> res.json is not wrapped (identity check)', () => {
    const { route } = makeRouteFactory({ validateResponses: false });
    let capturedRes: Response | undefined;
    const [, wrapped] = route('get', '/identity', { response: z.object({ a: z.string() }) }, (_req, res) => {
      capturedRes = res;
      return res.json({ a: 'ok' });
    });
    const originalJson = (): void => {};
    const fakeRes = { json: originalJson, status: () => fakeRes } as unknown as Response;
    wrapped({} as never, fakeRes, (() => {}) as never);
    expect(fakeRes.json).toBe(originalJson);
    void capturedRes;
  });

  it("'warn' -> unchanged body, exactly one warn call", async () => {
    const logger = createLoggerSpy();
    const { route } = makeRouteFactory({ validateResponses: 'warn' }, logger);
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('get', '/warn', { response: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ a: 1 }),
    );
    app.get('/warn', validator, wrapped);

    const res = await request(app).get('/warn').expect(200);
    expect(res.body).toEqual({ a: 1 });
    expect(logger.warnCalls).toHaveLength(1);
  });

  it("'error' -> 500, invalid body withheld", async () => {
    const { route } = makeRouteFactory({ validateResponses: 'error' });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('get', '/error', { response: z.object({ a: z.string() }) }, (_req, res) =>
      res.json({ a: 1 }),
    );
    app.get('/error', validator, wrapped);

    const res = await request(app).get('/error').expect(500);
    expect(res.body).not.toEqual({ a: 1 });
  });

  it('AC-044c: per-route error beats global warn (warn 0 calls, 500)', async () => {
    const logger = createLoggerSpy();
    const { route } = makeRouteFactory({ validateResponses: 'warn' }, logger);
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route(
      'get',
      '/precedence',
      { response: z.object({ a: z.string() }), validateResponses: 'error' },
      (_req, res) => res.json({ a: 1 }),
    );
    app.get('/precedence', validator, wrapped);

    await request(app).get('/precedence').expect(500);
    expect(logger.warnCalls).toHaveLength(0);
  });
});
