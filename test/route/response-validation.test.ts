import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ApiDocsOptions } from '../../src/config/types.js';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('response validation on Express $major', ({ express }) => {
  function setup(
    options: ApiDocsOptions = {},
    routeOptions: object = {},
    body: unknown = { id: 'not-a-number' },
  ) {
    const logger = spyLogger();
    const api = createApiDocs({ logger, ...options });
    const seen: { json?: unknown } = {};
    const app = express();
    app.get(
      '/item',
      ...api.route(
        {
          responses: {
            200: z.object({ id: z.number() }),
            404: { description: 'Missing', schema: z.object({ error: z.string() }) },
            204: { description: 'Nothing' },
          },
          ...routeOptions,
        },
        (req: any, res: any) => {
          seen.json = res.json;
          if (req.query.missing) return res.status(404).json({ error: 5 });
          res.json(body);
        },
      ),
    );
    return { app, logger, seen };
  }

  it('AC-012: unset sends the invalid body unchanged and logs nothing', async () => {
    const { app, logger } = setup();
    const res = await request(app).get('/item');
    expect(res.status).toBe(200);
    expect(res.text).toBe(JSON.stringify({ id: 'not-a-number' }));
    expect(logger.calls).toHaveLength(0);
  });

  it('ADR-03: validateResponses false leaves res.json unwrapped', async () => {
    const { app, seen } = setup();
    await request(app).get('/item');
    expect(seen.json).toBe(express.response.json);
  });

  it("AC-013: 'warn' sends the body unchanged and warns exactly once", async () => {
    const { app, logger, seen } = setup({ validateResponses: 'warn' });
    const res = await request(app).get('/item');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'not-a-number' });
    expect(logger.count('warn')).toBe(1);
    expect(logger.count('warn', 'EAD_RESPONSE_INVALID')).toBe(1);
    expect(logger.calls[0]!.message).toContain('Response 200 of a typed route');
    expect(logger.calls[0]!.message).toContain('id:');
    expect(seen.json).not.toBe(express.response.json);
  });

  it("AC-014: 'error' sends a 500 and withholds the invalid body", async () => {
    const { app } = setup({ validateResponses: 'error' });
    const res = await request(app).get('/item');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.text).not.toContain('not-a-number');
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'The response did not match its declared schema.',
    });
  });

  it("AC-044c: per-route 'error' beats global 'warn'", async () => {
    const { app, logger } = setup({ validateResponses: 'warn' }, { validateResponses: 'error' });
    expect((await request(app).get('/item')).status).toBe(500);
    expect(logger.count('warn')).toBe(0);
  });

  it('valid bodies pass through unchanged', async () => {
    const { app, logger } = setup({ validateResponses: 'error' }, {}, { id: 3 });
    const res = await request(app).get('/item');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 3 });
    expect(logger.calls).toHaveLength(0);
  });

  it('selects the schema by status code', async () => {
    const { app } = setup({ validateResponses: 'error' });
    const res = await request(app).get('/item?missing=1');
    expect(res.status).toBe(500);
  });

  it('statuses without a schema are not validated; default applies otherwise', async () => {
    const api = createApiDocs({ logger: spyLogger(), validateResponses: 'error' });
    const app = express();
    app.get(
      '/a',
      ...api.route({ responses: { 200: z.string() } }, (_q, res: any) => res.status(201).json(5)),
    );
    app.get(
      '/b',
      ...api.route({ responses: { default: z.string() } }, (_q, res: any) =>
        res.status(202).json(5),
      ),
    );
    expect((await request(app).get('/a')).status).toBe(201);
    expect((await request(app).get('/b')).status).toBe(500);
  });

  it('labels warnings with the declared method and path', async () => {
    const logger = spyLogger();
    const api = createApiDocs({ logger, validateResponses: 'warn' });
    const app = express();
    app.get(
      '/p',
      ...api.route({ method: 'get', path: '/p', responses: { 200: z.string() } }, (_q, res: any) =>
        res.json(1),
      ),
    );
    await request(app).get('/p');
    expect(logger.calls[0]!.message).toContain('GET /p');
  });
});
