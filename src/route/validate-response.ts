import type { Response } from 'express';
import type { SchemaAdapter } from '../adapter/types.js';
import type { Logger } from '../core/types.js';
import { PROBLEM_MEDIA_TYPE, responseProblem } from './problem.js';

export interface ResponseValidationConfig {
  /** Status code (or `default`) to response schema. */
  schemas: ReadonlyMap<string, unknown>;
  mode: 'warn' | 'error';
  adapter: SchemaAdapter;
  logger: Logger;
  label: string;
}

/**
 * Wrap `res.json` for one response. `res.send(object)` delegates to `res.json`, so it is
 * covered too; raw strings, buffers and streams are not validated.
 */
export function installResponseValidation(res: Response, config: ResponseValidationConfig): void {
  const { schemas, mode, adapter, logger, label } = config;
  const original = res.json;
  res.json = function validatedJson(this: Response, body?: unknown) {
    const status = String(this.statusCode);
    const schema = schemas.get(status) ?? schemas.get('default');
    if (schema !== undefined) {
      const result = adapter.validate(schema, body);
      if (!result.ok) {
        if (mode === 'error') {
          this.json = original;
          this.status(500).type(PROBLEM_MEDIA_TYPE);
          return original.call(this, responseProblem());
        }
        logger.warn(
          `Response ${status} of ${label} does not match its schema: ` +
            result.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
          { code: 'EAD_RESPONSE_INVALID', route: label, status: this.statusCode },
        );
      }
    }
    return original.call(this, body);
  } as Response['json'];
}
