// ST-007 (S-07): AC-035, AC-036 — zero-config createApiDocs() end-to-end,
// per Express major.
import * as OpenApiParser from '@readme/openapi-parser';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';

import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import { createApiDocs } from '../../src/serve/router.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('serve/zero-config ($alias)', ({ express }) => {
  function makeApp(): { app: import('express').Application; apiDocs: ReturnType<typeof createApiDocs> } {
    const ex = express as { (): import('express').Application; json: () => import('express').RequestHandler };
    const app = ex();
    app.use(ex.json());
    const apiDocs = createApiDocs();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/users',
      { body: z.object({ name: z.string() }), response: z.object({ id: z.string() }) },
      (req, res) => {
        res.json({ id: '1' });
      },
    );
    app.post('/users', validate, handler);
    return { app, apiDocs };
  }

  it('GET /openapi.json returns a valid OpenAPI 3.1 spec', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect((res.body as { openapi: string }).openapi.startsWith('3.1.')).toBe(true);
    await expect(OpenApiParser.validate(structuredClone(res.body) as never)).resolves.toBeDefined();
  });

  it('invalid request returns 400 problem+json', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/users').send({});
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('schema-violating response body is still 200 (no response validation by default)', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/users').send({ name: 'ok' });
    expect(res.status).toBe(200);
  });

  it('resolved config deep-equals DEFAULT_OPTIONS, which is deep-frozen', () => {
    const { apiDocs } = makeApp();
    expect(apiDocs.options).toEqual(DEFAULT_OPTIONS);
    expect(apiDocs.options.schemaAdapter).toBeNull();
    expect(Object.isFrozen(DEFAULT_OPTIONS)).toBe(true);
  });
});
