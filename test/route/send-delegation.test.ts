import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express, RequestHandler } from 'express';
import { z } from 'zod';

import { majors } from '../fixtures/majors.js';
import { makeRouteFactory } from './support.js';

describe.each(majors)(
  'route/send-delegation: res.send(obj) delegates to res.json (Express $major, CR-7/AC-014)',
  ({ express }) => {
    const makeApp = express as unknown as () => Express;
    const jsonMw = (): RequestHandler => (express as unknown as { json: () => RequestHandler }).json();

    it('res.send(invalidObject) with validateResponses:error gives 500, payload not sent', async () => {
      const { route } = makeRouteFactory({ validateResponses: 'error' });
      const app = makeApp();
      app.use(jsonMw());
      const [validator, wrapped] = route(
        'get',
        '/send-invalid',
        { response: z.object({ a: z.string() }) },
        (_req, res) => res.send({ a: 1 }),
      );
      app.get('/send-invalid', validator, wrapped);

      const res = await request(app).get('/send-invalid').expect(500);
      expect(res.body).not.toEqual({ a: 1 });
    });

    it('res.send(validObject) gives 200 with the object as JSON', async () => {
      const { route } = makeRouteFactory({ validateResponses: 'error' });
      const app = makeApp();
      app.use(jsonMw());
      const [validator, wrapped] = route('get', '/send-valid', { response: z.object({ a: z.string() }) }, (_req, res) =>
        res.send({ a: 'ok' }),
      );
      app.get('/send-valid', validator, wrapped);

      const res = await request(app).get('/send-valid').expect(200);
      expect(res.body).toEqual({ a: 'ok' });
    });

    it('res.send(raw string) passes through unvalidated', async () => {
      const { route } = makeRouteFactory({ validateResponses: 'error' });
      const app = makeApp();
      app.use(jsonMw());
      const [validator, wrapped] = route(
        'get',
        '/send-string',
        { response: z.object({ a: z.string() }) },
        (_req, res) => res.send('raw string'),
      );
      app.get('/send-string', validator, wrapped);

      const res = await request(app).get('/send-string').expect(200);
      expect(res.text).toBe('raw string');
    });
  },
);
