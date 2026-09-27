import type { Request, RequestHandler, Response } from 'express';
import type { SchemaAdapter } from '../adapter/types.js';
import type { OnValidationError } from '../config/types.js';
import type { RequestLocation, ValidationIssue } from '../core/types.js';
import { PROBLEM_MEDIA_TYPE, validationProblem } from './problem.js';

export interface RequestSchemas {
  params?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
}

const LOCATIONS: ReadonlyArray<[keyof RequestSchemas, RequestLocation]> = [
  ['params', 'path'],
  ['query', 'query'],
  ['headers', 'header'],
  ['body', 'body'],
];

/** Replace `req[key]`, including Express 5's getter-only `req.query`. */
function assign(req: Request, key: keyof RequestSchemas, value: unknown): void {
  if (key === 'headers') return;
  Object.defineProperty(req, key, { value, writable: true, configurable: true, enumerable: true });
}

function sendValidationError(
  issues: ValidationIssue[],
  req: Request,
  res: Response,
  onValidationError: OnValidationError | null,
): void {
  if (onValidationError) {
    const custom = onValidationError(issues, req);
    res.status(custom.status);
    if (custom.contentType) res.type(custom.contentType);
    if (typeof custom.body === 'string' || Buffer.isBuffer(custom.body)) res.send(custom.body);
    else res.json(custom.body);
    return;
  }
  res.status(400).type(PROBLEM_MEDIA_TYPE).json(validationProblem(issues));
}

/**
 * Validate every present location, collecting all issues. On success the parsed
 * (coerced) values replace `req.params`, `req.query` and `req.body`.
 */
export function validateRequest(
  schemas: RequestSchemas,
  adapter: SchemaAdapter,
  req: Request,
): { ok: true } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const parsed: Array<[keyof RequestSchemas, unknown]> = [];
  for (const [key, location] of LOCATIONS) {
    const schema = schemas[key];
    if (schema === undefined) continue;
    const result = adapter.validate(schema, req[key] ?? (key === 'body' ? undefined : {}));
    if (result.ok) parsed.push([key, result.data]);
    else {
      for (const issue of result.issues) {
        issues.push({ in: location, path: issue.path.join('.'), message: issue.message });
      }
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  for (const [key, value] of parsed) assign(req, key, value);
  return { ok: true };
}

export interface RequestValidatorConfig {
  schemas: RequestSchemas;
  adapter: SchemaAdapter;
  onValidationError: OnValidationError | null;
  /** Called after a successful validation, e.g. to install response validation. */
  onPass?: (req: Request, res: Response) => void;
}

export function createRequestValidator(config: RequestValidatorConfig): RequestHandler {
  const { schemas, adapter, onValidationError, onPass } = config;
  const hasSchemas = LOCATIONS.some(([key]) => schemas[key] !== undefined);
  return function validateRequestMiddleware(req, res, next) {
    try {
      if (hasSchemas) {
        const result = validateRequest(schemas, adapter, req);
        if (!result.ok) {
          sendValidationError(result.issues, req, res, onValidationError);
          return;
        }
      }
      onPass?.(req, res);
      next();
    } catch (error) {
      next(error);
    }
  };
}
