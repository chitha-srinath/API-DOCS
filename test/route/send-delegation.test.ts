import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('res.send delegation on Express $major (CR-7)', ({ express }) => {
  const api = createApiDocs({ logger: spyLogger(), validateResponses: 'error' });
  const app = express();
  const responses = { 200: z.object({ ok: z.boolean() }) };
  app.get('/bad', ...api.route({ responses }, (_q, res: any) => res.send({ ok: 'yes' })));
  app.get('/good', ...api.route({ responses }, (_q, res: any) => res.send({ ok: true })));
  app.get('/raw', ...api.route({ responses }, (_q, res: any) => res.send('raw string')));

  it('res.send(invalidObject) is validated', async () => {
    const res = await request(app).get('/bad');
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('yes');
  });

  it('res.send(validObject) is sent as JSON', async () => {
    const res = await request(app).get('/good');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('raw strings pass through unvalidated (documented limit)', async () => {
    const res = await request(app).get('/raw');
    expect(res.status).toBe(200);
    expect(res.text).toBe('raw string');
  });
});
