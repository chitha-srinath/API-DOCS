import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express, RequestHandler } from 'express';

import { majors } from '../fixtures/majors.js';
import { obj, str, stubAdapter } from '../fixtures/stub-adapter.js';
import { makeRouteFactory } from './support.js';
import type { SchemaAdapter } from '../../src/adapter/types.js';
import type { TypedRequestHandler } from '../../src/route/typed.js';

type AnyTypedHandler = TypedRequestHandler<unknown, unknown, unknown>;

describe.each(majors)('route/stub-adapter (Express $major, AC-005, AC-047, ADR-38)', ({ express }) => {
  const makeApp = express as unknown as () => Express;
  const jsonMw = (): RequestHandler => (express as unknown as { json: () => RequestHandler }).json();
  const bodySchema = obj({ name: str() }, ['name']);

  it('invalid body -> 400 problem+json, handler 0 calls; valid body -> handler gets parsed data', async () => {
    const handler = vi.fn<AnyTypedHandler>((req, res) => res.json(req.body as unknown));
    const { route } = makeRouteFactory({ schemaAdapter: stubAdapter as unknown as never });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('post', '/stub', { body: bodySchema }, handler);
    app.post('/stub', validator, wrapped);

    const bad = await request(app).post('/stub').send({}).expect(400);
    expect(bad.headers['content-type']).toContain('application/problem+json');
    expect(handler).not.toHaveBeenCalled();

    const good = await request(app).post('/stub').send({ name: 'a' }).expect(200);
    expect(good.body).toEqual({ name: 'a' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('meta.adapter overrides global schemaAdapter', async () => {
    const globalAdapter: SchemaAdapter<unknown> = {
      name: 'global-spy',
      isSchema: (_x: unknown): _x is unknown => true,
      validate: vi.fn(() => ({ ok: true as const, data: {} })),
      toJSONSchema: () => ({}),
    };
    const { route } = makeRouteFactory({ schemaAdapter: globalAdapter as unknown as never });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route(
      'post',
      '/override',
      { body: bodySchema, adapter: stubAdapter as unknown as SchemaAdapter<unknown> },
      (_req, res) => res.json({ ok: true }),
    );
    app.post('/override', validator, wrapped);

    await request(app).post('/override').send({ name: 'a' }).expect(200);
    expect(globalAdapter.validate).not.toHaveBeenCalled();
  });

  it('global schemaAdapter used when no meta.adapter', async () => {
    const globalAdapter: SchemaAdapter<unknown> = {
      name: 'global-used',
      isSchema: (_x: unknown): _x is unknown => true,
      validate: vi.fn(() => ({ ok: true as const, data: { name: 'x' } })),
      toJSONSchema: () => ({}),
    };
    const { route } = makeRouteFactory({ schemaAdapter: globalAdapter as unknown as never });
    const app = makeApp();
    app.use(jsonMw());
    const [validator, wrapped] = route('post', '/no-override', { body: bodySchema }, (_req, res) =>
      res.json({ ok: true }),
    );
    app.post('/no-override', validator, wrapped);

    await request(app).post('/no-override').send({ name: 'a' }).expect(200);
    expect(globalAdapter.validate).toHaveBeenCalled();
  });
});
