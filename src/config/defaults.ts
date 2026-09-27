// ST-002 (S-02): DEFAULT_OPTIONS, built from OPTION_SPEC and deep-frozen.
import { OPTION_SPEC } from './spec-table.js';
import type { ApiDocsOptions } from './types.js';

function setPath(target: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i] as string;
    const existing = node[part];
    if (typeof existing !== 'object' || existing === null) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1] as string] = value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function buildDefaults(): ApiDocsOptions {
  const result: Record<string, unknown> = {};
  for (const row of Object.values(OPTION_SPEC)) {
    setPath(result, row.path, row.default);
  }
  return result as ApiDocsOptions;
}

export const DEFAULT_OPTIONS: Readonly<ApiDocsOptions> = deepFreeze(buildDefaults());
