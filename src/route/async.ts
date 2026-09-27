// ST-004 (S-04, component C3, ADR-33): wraps a typed handler so a rejected
// promise (or a synchronous throw) is forwarded to `next(err)` exactly once,
// even if `res.headersSent` is already true. Behaviour is identical on
// Express 4 and 5 (AC-024).
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function wrapAsync(handler: RequestHandler): RequestHandler {
  return function wrapped(req: Request, res: Response, next: NextFunction): void {
    let settled = false;

    const settleOnce = (err: unknown): void => {
      if (settled) return;
      settled = true;
      next(err as never);
    };

    const guardedNext = ((err?: unknown) => {
      settleOnce(err);
    }) as NextFunction;

    let result: unknown;
    try {
      result = handler(req, res, guardedNext);
    } catch (err) {
      settleOnce(err);
      return;
    }

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      Promise.resolve(result as PromiseLike<unknown>).then(
        () => {
          // resolved handlers never call next themselves; nothing to do.
        },
        (err: unknown) => {
          settleOnce(err);
        },
      );
    }
  };
}
