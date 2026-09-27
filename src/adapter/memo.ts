import type { Logger } from '../core/types.js';
import { EAD_SCHEMA_NO_JSONSCHEMA } from './errors.js';
import { NO_JSON_SCHEMA } from './standard.js';
import type { JSONSchema, SchemaAdapter, SchemaIO } from './types.js';

interface IoCache {
  input?: JSONSchema;
  output?: JSONSchema;
}

// ADR-03: wraps any adapter with a WeakMap<schema, JSONSchema> memoization, keyed per
// schema identity and per io. ADR-31(2): warns exactly once per schema identity when the
// wrapped adapter returns the shared NO_JSON_SCHEMA sentinel.
export function memoizeAdapter<S>(adapter: SchemaAdapter<S>, logger?: Logger): SchemaAdapter<S> {
  const cache = new WeakMap<object, IoCache>();
  const warned = new WeakSet<object>();

  return {
    name: adapter.name,
    isSchema: (x: unknown): x is S => adapter.isSchema(x),
    validate: (schema: S, input: unknown) => adapter.validate(schema, input),
    toJSONSchema(schema: S, io: SchemaIO): JSONSchema {
      const key = schema as unknown as object;
      let entry = cache.get(key);
      if (!entry) {
        entry = {};
        cache.set(key, entry);
      }
      const cached = entry[io];
      if (cached !== undefined) return cached;

      const result = adapter.toJSONSchema(schema, io);
      if (result === NO_JSON_SCHEMA) {
        if (!warned.has(key)) {
          warned.add(key);
          logger?.warn(EAD_SCHEMA_NO_JSONSCHEMA, adapter.name);
        }
        const fresh: JSONSchema = {};
        entry[io] = fresh;
        return fresh;
      }

      entry[io] = result;
      return result;
    },
  };
}
