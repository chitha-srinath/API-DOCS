import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forward sync throws and async rejections to `next(err)`, identically on Express 4
 * and 5. Nothing is forwarded if a response was already sent.
 */
export function wrapAsync(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return function wrapped(req, res, next) {
    const forward = (error: unknown): void => {
      if (!res.headersSent) next(error);
    };
    try {
      const result = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(undefined, forward);
      }
    } catch (error) {
      forward(error);
    }
  };
}
