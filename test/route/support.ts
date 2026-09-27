// ST-004 (S-04): shared test-only helpers for `test/route/**` and
// `test/registry/**`. Not a fixture (ADR-39 fixtures stay in `test/fixtures/**`);
// this is plain support code within this story's own owned test directories.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { createRegistry } from '../../src/registry/registry.js';
import type { ApiDocsOptions } from '../../src/config/types.js';
import type { Logger } from '../../src/core/types.js';
import { createRoute, type RouteFn } from '../../src/route/typed.js';

export interface LoggerSpy extends Logger {
  readonly warnCalls: unknown[][];
  readonly debugCalls: unknown[][];
}

export function createLoggerSpy(): LoggerSpy {
  const warnCalls: unknown[][] = [];
  const debugCalls: unknown[][] = [];
  return {
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
    },
    debug: (...args: unknown[]) => {
      debugCalls.push(args);
    },
    warnCalls,
    debugCalls,
  };
}

export function makeRouteFactory(
  options: Partial<ApiDocsOptions> = {},
  logger: Logger = createLoggerSpy(),
): { route: RouteFn; registry: ReturnType<typeof createRegistry>; logger: Logger } {
  const registry = createRegistry();
  const route = createRoute({ registry, options: options as ApiDocsOptions, logger });
  return { route, registry, logger };
}

/** A 4-arity error middleware that records the error and ends the response with 500. */
export function capturingErrorMiddleware(sink: {
  error?: unknown;
  calls: number;
}): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return (err, _req, res, _next) => {
    sink.error = err;
    sink.calls += 1;
    if (!res.headersSent) {
      res.status(500).end();
    }
  };
}

export type AnyRequestHandler = RequestHandler;
