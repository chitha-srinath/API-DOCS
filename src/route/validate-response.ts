// ST-004 (S-04, component C3, ADR-03): response validation. Wraps `res.json`
// only when `validateResponses !== false`; because Express's `res.send`
// delegates plain objects to `res.json`, this also covers `res.send(obj)`
// (CR-7). Raw strings and streams are documented as not validated.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { Logger } from '../core/types.js';
import type { SchemaAdapter } from '../adapter/types.js';

export interface ValidateResponseOptions {
  readonly schema: unknown;
  readonly adapter: SchemaAdapter<unknown>;
  readonly mode: false | 'warn' | 'error';
  readonly logger: Logger;
}

export function wrapResponseValidation(handler: RequestHandler, options: ValidateResponseOptions): RequestHandler {
  const { schema, adapter, mode, logger } = options;

  // ADR-03: no wrap at all when responses are not validated, or no response
  // schema was given for this route — `res.json` stays identical.
  if (mode === false || schema === undefined) {
    return handler;
  }

  return function withResponseValidation(req: Request, res: Response, next: NextFunction): unknown {
    const originalJson = res.json.bind(res);

    res.json = ((body?: unknown): Response => {
      const result = adapter.validate(schema, body);
      if (result.ok) {
        return originalJson(body);
      }

      if (mode === 'warn') {
        logger.warn('EAD_RESPONSE_INVALID', { issues: result.issues });
        return originalJson(body);
      }

      // mode === 'error': the invalid body is withheld; the client gets a 500.
      res.status(500);
      return originalJson({ message: 'Response validation failed.' });
    }) as Response['json'];

    return handler(req, res, next);
  };
}
