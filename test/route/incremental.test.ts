import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express, RequestHandler, Router } from 'express';
import { z } from 'zod';

import { majors } from '../fixtures/majors.js';
import { makeRouteFactory } from './support.js';

describe.each(majors)(
  'route/incremental: plain routes keep working next to a typed route (Express $major, AC-021)',
  ({ express }) => {
    const makeApp = express as unknown as () => Express;
    const makeRouter = (): Router => (express as unknown as { Router: () => Router }).Router();
    const jsonMw = (): RequestHandler => (express as unknown as { json: () => RequestHandler }).json();

    it('invalid body to /plain still gets the plain response; only /typed validates', async () => {
      const router = makeRouter();
      router.get('/plain', (_req, res) => res.json({ plain: 'get' }));
      router.post('/plain', (req, res) => res.json({ plain: 'post', body: req.body as unknown }));

      const { route } = makeRouteFactory();
      const [validator, wrapped] = route('post', '/typed', { body: z.object({ a: z.string() }) }, (_req, res) =>
        res.json({ typed: true }),
      );
      router.post('/typed', validator, wrapped);

      const app = makeApp();
      app.use(jsonMw());
      app.use(router);

      await request(app).get('/plain').expect(200, { plain: 'get' });
      await request(app)
        .post('/plain')
        .send({ anything: 'goes' })
        .expect(200, { plain: 'post', body: { anything: 'goes' } });
      await request(app).post('/typed').send({ anything: 'goes' }).expect(400);
      await request(app).post('/typed').send({ a: 'ok' }).expect(200, { typed: true });
    });
  },
);
