import type { RequestHandler } from 'express';
import type { OperationMeta, RouteRegistry } from '../core/types.js';
import { tagHandler, toOperationMeta } from './typed.js';

/** Documentation for a plain route; schemas here are documented, never enforced. */
export type DescribeDefinition = OperationMeta;

/**
 * Build the `describe()` helper for one instance. It returns a pass-through middleware
 * that documents a plain route without validating it:
 * `router.get('/health', describe({ summary: 'Health' }), handler)`.
 */
export function createDescribe(registry: RouteRegistry) {
  return function describe(meta: DescribeDefinition = {}): RequestHandler {
    const docs = toOperationMeta(meta);
    const passThrough: RequestHandler = function describedRoute(_req, _res, next) {
      next();
    };
    tagHandler(passThrough, { source: 'describe', meta: docs });
    registry.register({
      method: docs.method,
      localPath: docs.path,
      source: 'describe',
      meta: docs,
      handlerFn: passThrough,
    });
    return passThrough;
  };
}
