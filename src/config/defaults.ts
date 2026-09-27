import { OPTION_SPEC, isPlainObject } from './spec-table.js';
import type { ResolvedOptions } from './types.js';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export function deepFreeze<T>(value: T): T {
  if ((isPlainObject(value) || Array.isArray(value)) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function cloneDefault(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneDefault);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneDefault(v)]));
  }
  return value;
}

function buildDefaults(): ResolvedOptions {
  const root: Record<string, unknown> = {};
  for (const [path, row] of Object.entries(OPTION_SPEC)) {
    const segments = path.split('.');
    const last = segments.pop() as string;
    let node = root;
    for (const segment of segments) {
      node[segment] ??= {};
      node = node[segment] as Record<string, unknown>;
    }
    node[last] = cloneDefault(row.default);
  }
  return root as unknown as ResolvedOptions;
}

/** Every option's default value, deep-frozen. Equals `createApiDocs().options`. */
export const DEFAULT_OPTIONS: DeepReadonly<ResolvedOptions> = deepFreeze(buildDefaults());

/** Keys whose values are user-owned objects: kept by reference and never frozen. */
const BY_REFERENCE = new Set(['adapter', 'logger']);

/** A deep-frozen snapshot of resolved options that shares no mutable state with the caller. */
export function freezeResolved(options: ResolvedOptions): DeepReadonly<ResolvedOptions> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    out[key] = BY_REFERENCE.has(key) ? value : deepFreeze(cloneDefault(value));
  }
  return Object.freeze(out) as unknown as DeepReadonly<ResolvedOptions>;
}

export type { DeepReadonly };
