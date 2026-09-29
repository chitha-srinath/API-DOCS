// ST-006 (S-06, component C6): buildSpec(ops, config, adapter). Pure: no
// Express, no IO, no `zod`, no `src/registry/registry.ts` import (ADR-21).
// Dedupes with precedence typed = describe > plain (AC-031), applies
// include/exclude through the in-house glob (AC-030/AC-041), self-excludes
// specPath/docsPath (AC-033), applies naming defaults/strategies (A-3/A-4,
// AC-042), the auto-400 ProblemDetails `$ref` (AC-011), security inheritance
// (AC-039), `detectedDefaultResponse` (AC-041) and info/servers/tags
// (AC-038). Output goes through the canonical key sort (AC-034).
import type { DetectedOperation, HttpMethod, OperationMeta, RouteRegistry } from '../core/types.js';
import type { JSONSchema, SchemaAdapter } from '../adapter/types.js';
import { DEFAULT_OPTIONS } from '../config/defaults.js';
import { mergeOptions } from '../config/merge.js';
import type { ApiDocsOptions } from '../config/types.js';
import { PROBLEM_CONTENT_TYPE, PROBLEM_DETAILS_SCHEMA } from '../route/problem.js';
import { canonicalize } from './canonical.js';
import { matchAnyGlob } from './glob.js';
import { assignOperationIds, defaultOperationId, defaultTag } from './naming.js';

/** `buildSpec`'s input element: a `DetectedOperation` plus an optional stable registration id (A-3 collision suffixing, AC-034). */
export interface SpecOperation extends DetectedOperation {
  readonly id?: number;
}

/** The loosely-typed extra fields `OperationMeta`'s index signature carries for typed routes (ADR-38, RouteMeta). */
interface ExtendedMeta extends OperationMeta {
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
  adapter?: SchemaAdapter<unknown>;
  security?: Array<Record<string, string[]>>;
  operationId?: string;
}

export type OpenApiDocument = Record<string, unknown>;

const PROBLEM_SCHEMA_NAME = 'ProblemDetails';
const PROBLEM_REF = `#/components/schemas/${PROBLEM_SCHEMA_NAME}`;

function metaOf(op: SpecOperation): ExtendedMeta {
  return (op.meta ?? {}) as ExtendedMeta;
}

function resolveAdapter(op: SpecOperation, fallback: SchemaAdapter<unknown>): SchemaAdapter<unknown> {
  return metaOf(op).adapter ?? fallback;
}

function dedupeKey(op: SpecOperation): string {
  return `${op.method} ${op.path}`;
}

const PRECEDENCE: Record<DetectedOperation['source'], number> = { typed: 2, describe: 2, plain: 1 };

/** AC-031: typed = describe > plain. Ties keep the earlier (lower `id`/array-index) entry. */
function dedupe(ops: readonly SpecOperation[]): SpecOperation[] {
  const winners = new Map<string, { op: SpecOperation; rank: number }>();
  ops.forEach((op, index) => {
    const key = dedupeKey(op);
    const rank = PRECEDENCE[op.source];
    const existing = winners.get(key);
    const order = op.id ?? index;
    if (!existing) {
      winners.set(key, { op, rank });
      return;
    }
    const existingOrder = existing.op.id ?? ops.indexOf(existing.op);
    if (rank > existing.rank || (rank === existing.rank && order < existingOrder)) {
      winners.set(key, { op, rank });
    }
  });
  return ops.filter((op) => winners.get(dedupeKey(op))?.op === op);
}

function isAutoDetectFilter(value: ApiDocsOptions['autoDetect']): value is { include?: string[]; exclude?: string[] } {
  return typeof value === 'object' && value !== null;
}

function applyAutoDetectFilter(ops: SpecOperation[], config: ApiDocsOptions): SpecOperation[] {
  const autoDetect = config.autoDetect;
  return ops.filter((op) => {
    if (op.source !== 'plain') return true;
    if (autoDetect === false) return false;
    if (isAutoDetectFilter(autoDetect)) {
      if (autoDetect.include && autoDetect.include.length > 0 && !matchAnyGlob(autoDetect.include, op.path)) {
        return false;
      }
      if (autoDetect.exclude && autoDetect.exclude.length > 0 && matchAnyGlob(autoDetect.exclude, op.path)) {
        return false;
      }
    }
    return true;
  });
}

function selfExcludePaths(ops: SpecOperation[], config: ApiDocsOptions): SpecOperation[] {
  const specPath = config.specPath ?? (DEFAULT_OPTIONS.specPath as string);
  const docsPath = config.docsPath ?? (DEFAULT_OPTIONS.docsPath as string);
  return ops.filter((op) => op.path !== specPath && op.path !== docsPath);
}

interface JsonObjectSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
}

interface JsonSchemaWithDefs extends JsonObjectSchema {
  $defs?: Record<string, JSONSchema>;
}

/** A shared bag `pathParameters`/`queryParameters` hoist `$defs` into, keyed by def name (F-01 fix). */
type DefsCollector = Record<string, JSONSchema>;

/**
 * Recursively rewrites `$ref: '#/$defs/Name'` to `$ref: '#/components/schemas/Name'`
 * so a hoisted def bag stays internally consistent once moved to `components.schemas`.
 */
function rewriteDefsRefs<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteDefsRefs(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      if (key === '$ref' && typeof item === 'string' && item.startsWith('#/$defs/')) {
        output[key] = `#/components/schemas/${item.slice('#/$defs/'.length)}`;
      } else {
        output[key] = rewriteDefsRefs(item);
      }
    }
    return output as unknown as T;
  }
  return value;
}

/**
 * F-01 fix: `adapter.toJSONSchema()` output for a `.meta({id})`-tagged (or otherwise
 * named/reused) Zod/Standard-Schema schema carries the named subschema in a sibling
 * `$defs` bag with a `$ref` in its place. `pathParameters`/`queryParameters` only ever
 * extracted `schema.properties[name]`, silently dropping `$defs` and leaving a dangling,
 * unresolvable `$ref` (confirmed via the default `standardSchemaAdapter` too, not just
 * the opt-in `zodAdapter`). This hoists any `$defs` into the shared `defs` collector
 * (merged into `components.schemas` by `buildSpec`) and rewrites refs to point there,
 * returning the schema with `$defs` stripped.
 */
function hoistSchemaDefs(schema: JsonSchemaWithDefs, defs: DefsCollector): JsonObjectSchema {
  const { $defs, ...rest } = schema;
  if ($defs) {
    for (const [name, defSchema] of Object.entries($defs)) {
      const rewritten = rewriteDefsRefs(defSchema);
      if (name in defs) {
        // Two different .meta({id}) schemas sharing the same name would
        // otherwise collide silently: first-writer-wins while every $ref
        // still points at the surviving entry, producing a structurally
        // valid but semantically wrong document (e.g. a route documented
        // as a string when its real schema is a number) with no warning.
        // Benign re-registration of the *same* schema (the common case -
        // one named schema reused across many routes) must stay a no-op,
        // so only a genuine content mismatch fails fast.
        if (JSON.stringify(defs[name]) !== JSON.stringify(rewritten)) {
          throw new Error(
            `express-api-docs: two different schemas both use the name "${name}" ` +
              `(via .meta({ id: '${name}' }) or an equivalent named/reused schema). ` +
              `Named schemas must be unique per name across the whole app - rename one ` +
              'of them, or reuse the exact same schema instance/definition.',
          );
        }
        continue;
      }
      defs[name] = rewritten;
    }
  }
  return rewriteDefsRefs(rest) as JsonObjectSchema;
}

function pathParameters(
  op: SpecOperation,
  adapter: SchemaAdapter<unknown>,
  defs: DefsCollector,
): Record<string, unknown>[] {
  const meta = metaOf(op);
  const schema =
    meta.params !== undefined
      ? hoistSchemaDefs(adapter.toJSONSchema(meta.params, 'input') as JsonSchemaWithDefs, defs)
      : undefined;
  return op.pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: schema?.properties?.[name] ?? { type: 'string' },
  }));
}

function queryParameters(
  op: SpecOperation,
  adapter: SchemaAdapter<unknown>,
  defs: DefsCollector,
): Record<string, unknown>[] {
  const meta = metaOf(op);
  if (meta.query === undefined) return [];
  const schema = hoistSchemaDefs(adapter.toJSONSchema(meta.query, 'input') as JsonSchemaWithDefs, defs);
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return Object.keys(properties).map((name) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: properties[name],
  }));
}

function requestBodyOf(op: SpecOperation, adapter: SchemaAdapter<unknown>): Record<string, unknown> | undefined {
  const meta = metaOf(op);
  if (meta.body === undefined) return undefined;
  const schema = adapter.toJSONSchema(meta.body, 'input');
  return { required: true, content: { 'application/json': { schema } } };
}

function hasRequestSchema(op: SpecOperation): boolean {
  const meta = metaOf(op);
  return meta.params !== undefined || meta.query !== undefined || meta.body !== undefined;
}

function responsesOf(
  op: SpecOperation,
  adapter: SchemaAdapter<unknown>,
  config: ApiDocsOptions,
): Record<string, unknown> {
  const meta = metaOf(op);
  const responses: Record<string, unknown> = {};

  if (meta.response !== undefined) {
    const schema = adapter.toJSONSchema(meta.response, 'output');
    responses['200'] = { description: 'OK', content: { 'application/json': { schema } } };
  } else if (op.source === 'plain' && config.detectedDefaultResponse) {
    const { status, description } = config.detectedDefaultResponse;
    responses[String(status)] = { description };
  } else {
    responses['200'] = { description: 'OK' };
  }

  if (op.source === 'typed' && hasRequestSchema(op)) {
    responses['400'] = {
      description: 'Bad Request',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: PROBLEM_REF } } },
    };
  }

  return responses;
}

function securityOf(op: SpecOperation, config: ApiDocsOptions): Array<Record<string, string[]>> | undefined {
  const meta = metaOf(op);
  if (meta.security !== undefined) return meta.security;
  return config.security;
}

function tagsOf(op: SpecOperation, config: ApiDocsOptions): string[] {
  const meta = metaOf(op);
  if (meta.tags !== undefined) return meta.tags;
  if (config.tagStrategy) return config.tagStrategy({ method: op.method, path: op.path });
  return [defaultTag(op.path)];
}

function baseOperationId(op: SpecOperation, config: ApiDocsOptions): string {
  const meta = metaOf(op);
  if (meta.operationId !== undefined) return meta.operationId;
  if (config.operationIdStrategy) return config.operationIdStrategy({ method: op.method, path: op.path });
  return defaultOperationId(op.method, op.path);
}

function buildOperation(
  op: SpecOperation,
  operationId: string,
  adapter: SchemaAdapter<unknown>,
  config: ApiDocsOptions,
  defs: DefsCollector,
): Record<string, unknown> {
  const meta = metaOf(op);
  const parameters = [...pathParameters(op, adapter, defs), ...queryParameters(op, adapter, defs)];
  const requestBody = requestBodyOf(op, adapter);
  const security = securityOf(op, config);

  const operation: Record<string, unknown> = {
    operationId,
    tags: tagsOf(op, config),
    responses: responsesOf(op, adapter, config),
  };
  if (meta.summary !== undefined) operation.summary = meta.summary;
  if (meta.description !== undefined) operation.description = meta.description;
  if (parameters.length > 0) operation.parameters = parameters;
  if (requestBody) operation.requestBody = requestBody;
  if (security !== undefined) operation.security = security;
  return operation;
}

function infoOf(config: ApiDocsOptions): Record<string, unknown> {
  return { title: 'API', version: '0.0.0', ...config.openapi?.info };
}

/**
 * Consumes a `RouteRegistry` through `entries()` only (ADR-27c) and maps each
 * entry to a `SpecOperation` at its declared `localPath`, carrying `id` for
 * A-3 collision suffixing. Intended for callers that have not (or cannot)
 * walk the app; a walked result from `introspect()` still emits an entry the
 * walk missed at `localPath` per ADR-17.
 */
export function specOperationsFromRegistry(registry: RouteRegistry): SpecOperation[] {
  return registry.entries().map((entry) => ({
    id: entry.id,
    method: entry.method,
    path: entry.localPath,
    pathParams: [],
    source: entry.source,
    meta: entry.meta,
  }));
}

/** Pure spec builder. `adapter` is the already-resolved fallback (ADR-38); `meta.adapter` wins per operation. */
export function buildSpec(
  ops: readonly SpecOperation[],
  config: ApiDocsOptions,
  adapter: SchemaAdapter<unknown>,
): OpenApiDocument {
  const merged = mergeOptions(DEFAULT_OPTIONS as ApiDocsOptions, config, {});

  let filtered = selfExcludePaths([...ops], merged);
  filtered = applyAutoDetectFilter(filtered, merged);
  filtered = dedupe(filtered);

  const idInputs = filtered.map((op, index) => ({
    id: op.id ?? index,
    base: baseOperationId(op, merged),
  }));
  const resolvedIds = assignOperationIds(idInputs);

  const defs: DefsCollector = {};
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [index, op] of filtered.entries()) {
    const id = op.id ?? index;
    const operationId = resolvedIds.get(id) as string;
    const opAdapter = resolveAdapter(op, adapter);
    const pathEntry = (paths[op.path] ??= {});
    pathEntry[op.method as HttpMethod] = buildOperation(op, operationId, opAdapter, merged, defs);
  }

  const components: Record<string, unknown> = {
    schemas: { [PROBLEM_SCHEMA_NAME]: PROBLEM_DETAILS_SCHEMA, ...defs },
  };
  if (merged.securitySchemes) components.securitySchemes = merged.securitySchemes;

  const doc: OpenApiDocument = {
    openapi: '3.1.0',
    info: infoOf(merged),
    paths,
    components,
  };
  if (merged.openapi?.servers) doc.servers = merged.openapi.servers;
  if (merged.openapi?.tags) doc.tags = merged.openapi.tags;

  return canonicalize(doc) as OpenApiDocument;
}
