import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('incremental adoption on Express $major (AC-021)', ({ express }) => {
  const api = createApiDocs({ logger: spyLogger() });
  const router = express.Router();
  router.get('/plain', (_req, res) => res.send('plain get'));
  router.post('/plain', (req, res) => res.json({ echoed: req.body }));
  router.post(
    '/typed',
    ...api.route({ body: z.object({ n: z.number() }) }, (req, res) => res.json(req.body)),
  );
  const app = express();
  app.use(express.json());
  app.use('/r', router);

  it('plain routes behave as before', async () => {
    expect((await request(app).get('/r/plain')).text).toBe('plain get');
    const res = await request(app).post('/r/plain').send({ n: 'not a number' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ echoed: { n: 'not a number' } });
  });

  it('only the typed route validates', async () => {
    expect((await request(app).post('/r/typed').send({ n: 'x' })).status).toBe(400);
    expect((await request(app).post('/r/typed').send({ n: 1 })).body).toEqual({ n: 1 });
  });
});
