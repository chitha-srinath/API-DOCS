import { isPlainObject } from './spec-table.js';

/**
 * Deep merge with later layers winning: plain objects recurse; arrays, functions and
 * primitives replace; `undefined` never overrides. Inputs are not mutated.
 */
export function mergeOptions<T>(base: T, ...layers: ReadonlyArray<unknown>): T {
  let result: unknown = base;
  for (const layer of layers) result = mergeTwo(result, layer);
  return result as T;
}

function mergeTwo(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlainObject(over) || !isPlainObject(base)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = mergeTwo(base[key], value);
  }
  return out;
}
