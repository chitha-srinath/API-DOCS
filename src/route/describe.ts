// ST-005 (S-05, component C4): `describe(meta)` returns a pass-through
// middleware tagged with `[META]`, `source: 'describe'`. It never validates.
// Per ADR-17, `describe.ts` only calls the S-04 `RouteRegistry`'s public
// `register()` API. Per ADR-44, `[META]` is load-bearing (cross-copy
// discovery fallback when `findByHandle` misses).
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { HttpMethod, OperationMeta, RouteRegistry } from '../core/types.js';
import { META } from '../core/types.js';

export interface DescribeFactoryDeps {
  readonly registry: RouteRegistry;
}

export type DescribeFn = (method: HttpMethod, localPath: string, meta: OperationMeta) => RequestHandler;

export function createDescribe(deps: DescribeFactoryDeps): DescribeFn {
  return function describe(method: HttpMethod, localPath: string, meta: OperationMeta): RequestHandler {
    const middleware: RequestHandler = function describeMiddleware(
      _req: Request,
      _res: Response,
      next: NextFunction,
    ): void {
      next();
    };

    (middleware as unknown as Record<PropertyKey, unknown>)[META] = { source: 'describe', method, meta };

    deps.registry.register({
      method,
      localPath,
      source: 'describe',
      meta,
      handlerFn: middleware,
    });

    return middleware;
  };
}
