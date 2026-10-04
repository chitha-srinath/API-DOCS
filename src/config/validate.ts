// ST-002 (S-02): validateOptions() — rejects unknown keys, rejects invalid
// values, enforces the A-9 cross-field rule, throws ApiDocsConfigError.
import { ApiDocsConfigError } from './errors.js';
import { OPTION_SPEC } from './spec-table.js';
import type { ApiDocsOptions, OptionRow } from './types.js';

const SPEC = OPTION_SPEC as Record<string, OptionRow>;
const GROUP_KEYS = new Set(['openapi']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRow(dotted: string, value: unknown): void {
  const row = SPEC[dotted];
  if (!row) {
    throw new ApiDocsConfigError(dotted, 'a known option');
  }
  if (value !== undefined && !row.check(value)) {
    throw new ApiDocsConfigError(dotted, row.allowed ?? row.description);
  }
}

/**
 * Validates a raw options object against `OPTION_SPEC`, throwing
 * `ApiDocsConfigError` synchronously on the first problem found (AC-045).
 */
export function validateOptions(options: unknown): ApiDocsOptions {
  const candidate = options === undefined ? {} : options;
  if (!isPlainObject(candidate)) {
    throw new ApiDocsConfigError('', 'an options object');
  }

  for (const key of Object.keys(candidate)) {
    const value = candidate[key];
    if (GROUP_KEYS.has(key)) {
      if (value === undefined) {
        continue;
      }
      if (!isPlainObject(value)) {
        throw new ApiDocsConfigError(key, 'an object');
      }
      for (const subKey of Object.keys(value)) {
        checkRow(`${key}.${subKey}`, value[subKey]);
      }
    } else {
      checkRow(key, value);
    }
  }

  return candidate as ApiDocsOptions;
}
