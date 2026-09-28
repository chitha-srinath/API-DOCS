import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express, NextFunction, Request, Response } from 'express';

import { majors } from '../fixtures/majors.js';
import { wrapAsync } from '../../src/route/async.js';
import { capturingErrorMiddleware } from './support.js';

describe.each(majors)(
  'route/async: wrapAsync reaches the error middleware exactly once (Express $major, AC-024)',
  ({ express }) => {
    const makeApp = express as unknown as () => Express;

    it('async throw reaches error middleware exactly once', async () => {
      const app = makeApp();
      const sink: { error?: unknown; calls: number } = { calls: 0 };
      app.get(
        '/throw',
        wrapAsync(async () => {
          throw new Error('boom');
        }),
      );
      app.use(capturingErrorMiddleware(sink));

      await request(app).get('/throw').expect(500);
      expect(sink.calls).toBe(1);
      expect((sink.error as Error).message).toBe('boom');
    });

    it('rejected promise reaches error middleware exactly once with the same error instance', async () => {
      const app = makeApp();
      const sink: { error?: unknown; calls: number } = { calls: 0 };
      const err = new Error('rejected');
      app.get(
        '/reject',
        wrapAsync((_req: Request, _res: Response, _next: NextFunction) => Promise.reject(err)),
      );
      app.use(capturingErrorMiddleware(sink));

      await request(app).get('/reject').expect(500);
      expect(sink.calls).toBe(1);
      expect(sink.error).toBe(err);
    });
  },
);
