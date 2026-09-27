import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

describe.each(majors)('async errors on Express $major (AC-024)', ({ express }) => {
  function setup(handler: () => unknown) {
    const api = createApiDocs({ logger: spyLogger() });
    const app = express();
    const errorMiddleware = vi.fn((err: Error, _req: any, res: any, _next: any) => {
      res.status(500).send(err.message);
    });
    app.get('/boom', ...api.route({}, handler));
    app.use(errorMiddleware);
    return { app, errorMiddleware };
  }

  it('an async throw reaches the error middleware exactly once', async () => {
    const error = new Error('boom');
    const { app, errorMiddleware } = setup(async () => {
      throw error;
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.text).toBe('boom');
    expect(errorMiddleware).toHaveBeenCalledTimes(1);
    expect(errorMiddleware.mock.calls[0]![0]).toBe(error);
  });

  it('a returned rejected promise reaches the error middleware exactly once', async () => {
    const error = new Error('rejected');
    const { app, errorMiddleware } = setup(() => Promise.reject(error));
    await request(app).get('/boom');
    expect(errorMiddleware).toHaveBeenCalledTimes(1);
    expect(errorMiddleware.mock.calls[0]![0]).toBe(error);
  });

  it('a sync throw reaches the error middleware exactly once', async () => {
    const { app, errorMiddleware } = setup(() => {
      throw new Error('sync');
    });
    await request(app).get('/boom');
    expect(errorMiddleware).toHaveBeenCalledTimes(1);
  });
});
