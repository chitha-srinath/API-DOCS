// ST-002 (S-02): mergeOptions(defaults, global, route). Component C1:
// "plain objects recurse; arrays, functions and primitives replace." Objects
// carrying function members (e.g. a duck-typed `schemaAdapter`) are treated
// as opaque values — a "port", not a data group — and replace wholly, so a
// partial override never inherits sibling fields from a shallower layer.
type PlainRecord = Record<string, unknown>;

/** Nested-optional mirror of `T`, so `global`/`route` need not repeat every sibling key. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

function isPlainDataObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  return !Object.values(value).some((member) => typeof member === 'function');
}

function mergeTwo<T extends PlainRecord>(base: T, override: PlainRecord): T {
  const result: PlainRecord = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    if (overrideValue === undefined) {
      // undefined never overrides a defined (or absent) base value.
      continue;
    }
    const baseValue = result[key];
    if (isPlainDataObject(baseValue) && isPlainDataObject(overrideValue)) {
      result[key] = mergeTwo(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result as T;
}

export function mergeOptions<T extends object>(defaults: T, global: DeepPartial<T>, route: DeepPartial<T>): T {
  const withGlobal = mergeTwo(defaults as unknown as PlainRecord, global as PlainRecord);
  const withRoute = mergeTwo(withGlobal, route as PlainRecord);
  return withRoute as unknown as T;
}
