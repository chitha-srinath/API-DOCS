import type { JSONSchema, SchemaAdapter, SchemaContext } from './types.js';

/**
 * Wrap an adapter so each schema is converted to JSON Schema at most once per `io`.
 * The cache is a `WeakMap`, so schemas are not kept alive by it.
 */
export function memoizeAdapter<S>(adapter: SchemaAdapter<S>): SchemaAdapter<S> {
  const caches = {
    input: new WeakMap<object, JSONSchema>(),
    output: new WeakMap<object, JSONSchema>(),
  };
  return {
    name: adapter.name,
    isSchema: (value): value is S => adapter.isSchema(value),
    validate: (schema, input) => adapter.validate(schema, input),
    toJSONSchema(schema: S, io: 'input' | 'output', ctx?: SchemaContext): JSONSchema {
      const key = schema as unknown;
      if ((typeof key !== 'object' && typeof key !== 'function') || key === null) {
        return adapter.toJSONSchema(schema, io, ctx);
      }
      const cache = caches[io];
      const hit = cache.get(key);
      if (hit) return hit;
      const converted = adapter.toJSONSchema(schema, io, ctx);
      cache.set(key, converted);
      return converted;
    },
  };
}
