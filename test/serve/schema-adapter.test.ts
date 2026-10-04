// ST-007 (S-07): AC-005, AC-047, ADR-38 — schema adapter wiring (global option,
// default, and per-route `meta.adapter` override).
import * as OpenApiParser from '@readme/openapi-parser';
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApiDocs } from '../../src/serve/router.js';
import { obj, str, stubAdapter } from '../fixtures/stub-adapter.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('serve/schema-adapter ($alias)', ({ express }) => {
  it('options.schemaAdapter: stubAdapter validates and appears in the spec', async () => {
    const ex = express as { (): import('express').Application; json: () => import('express').RequestHandler };
    const app = ex();
    app.use(ex.json());
    const apiDocs = createApiDocs({ schemaAdapter: stubAdapter });
    app.use(apiDocs.router);
    const bodySchema = obj({ name: str() }, ['name']);
    const [validate, handler] = apiDocs.route('post', '/things', { body: bodySchema }, (req, res) => {
      res.json({ received: req.body });
    });
    app.post('/things', validate, handler);

    const bad = await request(app).post('/things').send({});
    expect(bad.status).toBe(400);

    const good = await request(app).post('/things').send({ name: 'x' });
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ received: { name: 'x' } });

    const spec = await request(app).get('/openapi.json');
    const requestBody = spec.body.paths['/things'].post.requestBody;
    expect(requestBody.content['application/json'].schema).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    await expect(OpenApiParser.validate(structuredClone(spec.body) as never)).resolves.toBeDefined();
  });

  it('meta.adapter on one route overrides both the global option and the default', async () => {
    const ex = express as { (): import('express').Application; json: () => import('express').RequestHandler };
    const app = ex();
    app.use(ex.json());
    const globalCalls: string[] = [];
    const routeCalls: string[] = [];
    const globalAdapter = {
      ...stubAdapter,
      validate: (schema: unknown, input: unknown) => {
        globalCalls.push('validate');
        return stubAdapter.validate(schema as never, input);
      },
    };
    const routeAdapter = {
      ...stubAdapter,
      validate: (schema: unknown, input: unknown) => {
        routeCalls.push('validate');
        return stubAdapter.validate(schema as never, input);
      },
    };
    const apiDocs = createApiDocs({ schemaAdapter: globalAdapter });
    app.use(apiDocs.router);
    const bodySchema = obj({ name: str() }, ['name']);
    const [validate, handler] = apiDocs.route(
      'post',
      '/things',
      { body: bodySchema, adapter: routeAdapter },
      (req, res) => res.json({ ok: true }),
    );
    app.post('/things', validate, handler);

    await request(app).post('/things').send({ name: 'x' });
    expect(routeCalls.length).toBeGreaterThan(0);
    expect(globalCalls.length).toBe(0);
  });
});
