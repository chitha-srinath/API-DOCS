import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express, NextFunction, Request, Response } from 'express';

import { majors } from '../fixtures/majors.js';
import { wrapAsync } from '../../src/route/async.js';

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe.each(majors)('route/wrap-async: ADR-33 next(err) exactly once (Express $major)', ({ express }) => {
  const makeApp = express as unknown as () => Express;

  it('(a) rejection before any write: error middleware called exactly once', async () => {
    const app = makeApp();
    const sink = { calls: 0 };
    app.get(
      '/a',
      wrapAsync(async () => {
        throw new Error('before-write');
      }),
    );
    app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      sink.calls += 1;
      res.status(500).end();
    });
    await request(app).get('/a').expect(500);
    expect(sink.calls).toBe(1);
  });

  it('(b) res.write then rejection: exactly one next(err), socket closes within 1s even though headersSent', async () => {
    const app = makeApp();
    const sink = { calls: 0 };
    app.get(
      '/b',
      wrapAsync(async (_req: Request, res: Response) => {
        res.write('chunk');
        throw new Error('after-write');
      }),
    );
    app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      sink.calls += 1;
      if (res.headersSent) {
        res.socket?.destroy();
      } else {
        res.status(500).end();
      }
    });

    const outcome = await Promise.race([
      request(app)
        .get('/b')
        .catch((err: unknown) => err),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout waiting for socket close')), 1000)),
    ]);
    expect(outcome).toBeDefined();
    expect(sink.calls).toBe(1);
  });

  it('(c) handler already called next(err), then rejects: no second call', async () => {
    const app = makeApp();
    const sink = { calls: 0 };
    app.get(
      '/c',
      wrapAsync(async (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('first'));
        throw new Error('second');
      }),
    );
    app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      sink.calls += 1;
      res.status(500).end();
    });
    await request(app).get('/c').expect(500);
    await tick();
    expect(sink.calls).toBe(1);
  });
});

describe('route/wrap-async: unit extras with a mock next', () => {
  it('a synchronous throw is forwarded to next exactly once', () => {
    const next = vi.fn();
    const handler = wrapAsync(() => {
      throw new Error('sync-boom');
    });
    handler({} as never, {} as never, next as never);
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('sync-boom');
  });

  it('a resolved handler calls next 0 times', async () => {
    const next = vi.fn();
    const handler = wrapAsync(async () => 'ok');
    handler({} as never, {} as never, next as never);
    await tick();
    expect(next).not.toHaveBeenCalled();
  });
});
