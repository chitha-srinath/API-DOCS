// ST-004 (S-04, component C3): request validation middleware. Validates
// params/query/body through the resolved SchemaAdapter, in that order, and
// aggregates issues into RFC 9457 `problem+json`, or hands off to
// `onValidationError` (AC-007, AC-008, AC-009, AC-010, AC-040).
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { SchemaAdapter } from '../adapter/types.js';
import { buildProblem, PROBLEM_CONTENT_TYPE, type ProblemError, type ProblemErrorLocation } from './problem.js';

export interface RequestSchemas {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly body?: unknown;
}

export interface OnValidationErrorInput {
  readonly status: number;
  readonly errors: ProblemError[];
}

// Matches config's `OnValidationError = (error: unknown) => {status, body}` (ADR-38's
// route-level override), so a route-level hook is assignable straight from `ApiDocsOptions`.
export type OnValidationErrorHook = (error: unknown) => { status: number; body: unknown };

export interface ValidateRequestOptions {
  readonly schemas: RequestSchemas;
  readonly adapter: SchemaAdapter<unknown>;
  readonly validateRequests: boolean;
  readonly onValidationError?: OnValidationErrorHook;
}

const LOCATION_TO_PROBLEM_IN: Record<'params' | 'query' | 'body', ProblemErrorLocation> = {
  params: 'path',
  query: 'query',
  body: 'body',
};

/** Overwrites a request field even where Express 5 defines it as getter-only (`req.query`). */
function setRequestField(req: Request, key: 'params' | 'query' | 'body', value: unknown): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function createRequestValidator(options: ValidateRequestOptions): RequestHandler {
  const { schemas, adapter, validateRequests, onValidationError } = options;
  const locations: readonly ('params' | 'query' | 'body')[] = ['params', 'query', 'body'];

  return function validateRequest(req: Request, res: Response, next: NextFunction): void {
    if (validateRequests === false) {
      next();
      return;
    }

    const errors: ProblemError[] = [];

    for (const location of locations) {
      const schema = schemas[location];
      if (schema === undefined) continue;

      const input = req[location];
      const result = adapter.validate(schema, input);
      if (result.ok) {
        setRequestField(req, location, result.data);
      } else {
        const inTag = LOCATION_TO_PROBLEM_IN[location];
        for (const issue of result.issues) {
          errors.push({ in: inTag, path: issue.path, message: issue.message });
        }
      }
    }

    if (errors.length === 0) {
      next();
      return;
    }

    if (onValidationError) {
      const { status, body } = onValidationError({ status: 400, errors });
      res.status(status).json(body);
      return;
    }

    const problem = buildProblem(400, 'Bad Request', 'Request validation failed.', errors);
    res.status(400).type(PROBLEM_CONTENT_TYPE).json(problem);
  };
}
