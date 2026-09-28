// ST-005 (S-05): the S-4b fixture set, shared by the introspect suite and
// re-used by S-06's `test/spec/ac023.test.ts` — keep this export stable.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { META } from '../../src/core/types.js';

export interface MakeAppOptions {
  major: 4 | 5;
  express: unknown;
}

function taggedHandler(_req: Request, res: Response): void {
  res.json({ ok: true });
}
(taggedHandler as unknown as Record<PropertyKey, unknown>)[META] = {
  source: 'describe',
  meta: { summary: 'wrapped handler' },
};

/**
 * Simulates a third-party wrapper that preserves a `[META]` tag it does not
 * understand (a common defensive pattern for middleware wrappers), so the
 * detected op still carries `meta` via the ADR-44 fallback even though
 * `findByHandle` cannot match the wrapper's own identity.
 */
function wrap(fn: RequestHandler): RequestHandler {
  const wrapped: RequestHandler = (req: Request, res: Response, next: NextFunction) => fn(req, res, next);
  const tag = (fn as unknown as Record<PropertyKey, unknown>)[META];
  if (tag !== undefined) (wrapped as unknown as Record<PropertyKey, unknown>)[META] = tag;
  return wrapped;
}

function ok(_req: Request, res: Response): void {
  res.json({ ok: true });
}

/** Builds the S-4b app: nested router, mounted sub-app, wrapped handler, plain route. */
export function makeApp({ express }: MakeAppOptions): import('express').Application {
  const ex = express as {
    (): import('express').Application;
    Router: () => import('express').Router;
  };
  const app = ex();
  const router = ex.Router();
  router.get('/users/:id', ok);
  router.post('/users/:id', ok);
  app.use('/api', router);

  const subApp = ex();
  subApp.get('/items/:id', ok);
  app.use('/v1', subApp);

  app.get('/w', wrap(taggedHandler));
  app.get('/plain', ok);

  return app;
}
