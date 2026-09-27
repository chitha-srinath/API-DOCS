import type { JSONSchema, SchemaAdapter, SchemaContext } from '../adapter/types.js';
import { isPlainObject } from '../config/spec-table.js';
import type { OperationNamingInput, ResolvedOptions } from '../config/types.js';
import {
  HTTP_METHODS,
  type DetectedOperation,
  type HttpMethod,
  type Logger,
  type OperationMeta,
  type RegistryEntry,
  type ResponseSpec,
} from '../core/types.js';
import type { RawOperation } from '../introspect/index.js';
import { convertPath, type ExpressMajor } from '../introspect/paths.js';
import { PROBLEM_JSON_SCHEMA, PROBLEM_MEDIA_TYPE, PROBLEM_SCHEMA_NAME } from '../route/problem.js';
import { responseSchemaOf } from '../route/typed.js';
import { matchesAny } from './glob.js';
import { defaultOperationId, defaultTags } from './naming.js';
import { statusText } from './status.js';

export type OpenApiDocument = Record<string, unknown> & {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, Record<string, Record<string, unknown>>>;
};

export interface BuildInput {
  /** Routes found by the stack walk. */
  operations: readonly RawOperation[];
  /** Registry entries the walk did not find; emitted at their local path. */
  unlocated: readonly RegistryEntry[];
  /** Whether an app was walked (unlocated entries are then worth a warning). */
  walked: boolean;
  /** Express major used to read local paths of unlocated entries. */
  major: ExpressMajor;
  options: ResolvedOptions;
  adapter: SchemaAdapter;
  logger: Logger;
}

const METHOD_ORDER = new Map<string, number>(HTTP_METHODS.map((m, i) => [m, i]));

function rank(source: DetectedOperation['source']): number {
  return source === 'plain' ? 0 : 1;
}

function expressPathText(path: string | RegExp): string {
  return typeof path === 'string' ? path : String(path);
}

/** Convert walked and unlocated routes into operations with OpenAPI paths. */
export function detectOperations(input: BuildInput): DetectedOperation[] {
  const { logger } = input;
  const out: DetectedOperation[] = [];
  const skipped = new Set<string>();
  const push = (
    raw: Pick<RawOperation, 'method' | 'expressPath' | 'major' | 'source' | 'meta'> & {
      entryId?: number;
    },
  ): void => {
    const converted = convertPath(raw.expressPath, raw.major);
    if (!converted.ok) {
      const label = `${raw.method.toUpperCase()} ${expressPathText(raw.expressPath)}`;
      if (skipped.has(label)) return;
      skipped.add(label);
      const message = `Skipped ${label}: ${
        converted.reason === 'regexp'
          ? 'RegExp route paths cannot be expressed in OpenAPI'
          : converted.reason === 'unnamed-wildcard'
            ? 'unnamed wildcards cannot be expressed in OpenAPI (name it, e.g. /*rest)'
            : 'the path syntax is not supported'
      }.`;
      if (converted.reason === 'unsupported') logger.warn(message, { code: 'EAD_ROUTE_SKIPPED' });
      else logger.debug(message, { code: 'EAD_ROUTE_SKIPPED' });
      return;
    }
    for (const { path, params } of converted.paths) {
      out.push({
        method: raw.method,
        expressPath: expressPathText(raw.expressPath),
        path,
        pathParams: params,
        source: raw.source,
        meta: raw.meta,
        entryId: raw.entryId,
        order: out.length,
      });
    }
  };
  for (const raw of input.operations) push({ ...raw, entryId: raw.entry?.id });
  for (const entry of input.unlocated) {
    const where = entry.meta.operationId ?? entry.localPath ?? `#${entry.id}`;
    if (!entry.method || entry.localPath === undefined) {
      if (input.walked) {
        logger.warn(
          `A ${entry.source} route (${where}) was not found in the app's router stack and ` +
            'declares no method/path, so it is not documented.',
          { code: 'EAD_REGISTRY_UNLOCATED' },
        );
      }
      continue;
    }
    if (input.walked) {
      logger.warn(
        `A ${entry.source} route (${entry.method.toUpperCase()} ${entry.localPath}) was not ` +
          "found in the app's router stack; it is documented at its local path.",
        { code: 'EAD_REGISTRY_UNLOCATED' },
      );
    }
    push({
      method: entry.method,
      expressPath: entry.localPath,
      major: input.major,
      source: entry.source,
      meta: entry.meta,
      entryId: entry.id,
    });
  }
  return out;
}

/** Filter plain routes by `autoDetect`, drop the package's own endpoints, dedupe. */
export function selectOperations(
  ops: readonly DetectedOperation[],
  options: ResolvedOptions,
): DetectedOperation[] {
  const { enabled, include, exclude } = options.autoDetect;
  const own = new Set([options.specPath, options.docsPath]);
  const best = new Map<string, DetectedOperation>();
  for (const op of ops) {
    if (op.source === 'plain') {
      if (!enabled || own.has(op.path)) continue;
      if (include.length > 0 && !matchesAny(op.path, include)) continue;
      if (exclude.length > 0 && matchesAny(op.path, exclude)) continue;
    }
    const key = `${op.method} ${op.path}`;
    const current = best.get(key);
    if (!current || rank(op.source) > rank(current.source)) best.set(key, op);
  }
  return [...best.values()].sort(
    (a, b) =>
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
      (METHOD_ORDER.get(a.method) ?? 0) - (METHOD_ORDER.get(b.method) ?? 0),
  );
}

interface SchemaTools {
  adapter: SchemaAdapter;
  ctx: SchemaContext;
}

function toSchema(tools: SchemaTools, schema: unknown, io: 'input' | 'output'): JSONSchema {
  return tools.adapter.toJSONSchema(schema, io, tools.ctx);
}

function objectProperties(
  tools: SchemaTools,
  schema: unknown,
  label: string,
  logger: Logger,
): { properties: Record<string, JSONSchema>; required: Set<string> } {
  const json = toSchema(tools, schema, 'input');
  if (!isPlainObject(json.properties)) {
    logger.warn(
      `The ${label} schema is not an object schema, so its parameters are not documented.`,
      {
        code: 'EAD_SCHEMA_NOT_OBJECT',
      },
    );
    return { properties: {}, required: new Set() };
  }
  const required = Array.isArray(json.required) ? (json.required as string[]) : [];
  return { properties: json.properties as Record<string, JSONSchema>, required: new Set(required) };
}

function parameter(
  name: string,
  location: string,
  schema: JSONSchema,
  required: boolean,
): Record<string, unknown> {
  const param: Record<string, unknown> = { name, in: location };
  if (typeof schema.description === 'string') param.description = schema.description;
  if (required) param.required = true;
  param.schema = schema;
  return param;
}

function buildParameters(
  op: DetectedOperation,
  tools: SchemaTools,
  logger: Logger,
): Record<string, unknown>[] {
  const meta = op.meta ?? {};
  const label = `${op.method.toUpperCase()} ${op.path}`;
  const out: Record<string, unknown>[] = [];
  const pathProps =
    meta.params !== undefined
      ? objectProperties(tools, meta.params, `path params of ${label}`, logger)
      : undefined;
  for (const name of op.pathParams) {
    out.push(parameter(name, 'path', pathProps?.properties[name] ?? { type: 'string' }, true));
  }
  const locations: Array<[unknown, string, string]> = [
    [meta.query, 'query', 'query'],
    [meta.headers, 'header', 'headers'],
  ];
  for (const [schema, location, what] of locations) {
    if (schema === undefined) continue;
    const { properties, required } = objectProperties(tools, schema, `${what} of ${label}`, logger);
    for (const [name, propSchema] of Object.entries(properties)) {
      out.push(parameter(name, location, propSchema, required.has(name)));
    }
  }
  return out;
}

function buildResponses(
  op: DetectedOperation,
  tools: SchemaTools,
  options: ResolvedOptions,
): { responses: Record<string, unknown>; usesProblem: boolean } {
  const meta: OperationMeta = op.meta ?? {};
  const responses: Record<string, unknown> = {};
  for (const [status, value] of Object.entries(meta.responses ?? {})) {
    const spec: ResponseSpec = tools.adapter.isSchema(value) ? {} : ((value ?? {}) as ResponseSpec);
    const schema = responseSchemaOf(value, tools.adapter);
    const response: Record<string, unknown> = {
      description: spec.description ?? statusText(status),
    };
    if (schema !== undefined) {
      response.content = {
        [spec.contentType ?? 'application/json']: { schema: toSchema(tools, schema, 'output') },
      };
    }
    responses[status] = response;
  }
  if (Object.keys(responses).length === 0) {
    if (op.source === 'plain') {
      const { status, description } = options.detectedDefaultResponse;
      responses[String(status)] = { description };
    } else {
      responses['200'] = { description: statusText('200') };
    }
  }
  const hasRequestSchema = [meta.params, meta.query, meta.headers, meta.body].some(
    (s) => s !== undefined,
  );
  const usesProblem = op.source === 'typed' && hasRequestSchema && !('400' in responses);
  if (usesProblem) {
    responses['400'] = {
      description: statusText('400'),
      content: {
        [PROBLEM_MEDIA_TYPE]: { schema: { $ref: `#/components/schemas/${PROBLEM_SCHEMA_NAME}` } },
      },
    };
  }
  const sorted = Object.keys(responses).sort();
  return { responses: Object.fromEntries(sorted.map((k) => [k, responses[k]])), usesProblem };
}

function namingInput(op: DetectedOperation): OperationNamingInput {
  return { method: op.method, path: op.path, expressPath: op.expressPath, source: op.source };
}

/**
 * Build the OpenAPI 3.1 document. Pure: no Express, no IO. Output order is canonical
 * (paths sorted, methods in HTTP order, responses by status) so it is byte-stable.
 */
export function buildSpec(input: BuildInput): OpenApiDocument {
  const { options, logger } = input;
  const tools: SchemaTools = { adapter: input.adapter, ctx: { warn: (m, d) => logger.warn(m, d) } };
  const ops = selectOperations(detectOperations(input), options);

  const paths: OpenApiDocument['paths'] = {};
  const usedIds = new Map<string, number>();
  let usesProblem = false;
  for (const op of ops) {
    const meta = op.meta ?? {};
    const naming = namingInput(op);
    const operation: Record<string, unknown> = {};

    const tags =
      meta.tags ??
      (options.tags.length > 0
        ? options.tags
        : (options.tagStrategy?.(naming) ?? defaultTags(naming)));
    if (tags.length > 0) operation.tags = [...tags];
    if (meta.summary !== undefined) operation.summary = meta.summary;
    if (meta.description !== undefined) operation.description = meta.description;

    const baseId =
      meta.operationId ?? options.operationIdStrategy?.(naming) ?? defaultOperationId(naming);
    const seen = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, seen + 1);
    operation.operationId = seen === 0 ? baseId : `${baseId}_${seen + 1}`;

    const parameters = buildParameters(op, tools, logger);
    if (parameters.length > 0) operation.parameters = parameters;

    if (meta.body !== undefined) {
      operation.requestBody = {
        required: true,
        content: {
          [meta.bodyContentType ?? 'application/json']: {
            schema: toSchema(tools, meta.body, 'input'),
          },
        },
      };
    }

    const built = buildResponses(op, tools, options);
    operation.responses = built.responses;
    usesProblem ||= built.usesProblem;

    const security = meta.security ?? (options.security.length > 0 ? options.security : undefined);
    if (security !== undefined) operation.security = security.map((req) => ({ ...req }));
    if (meta.deprecated) operation.deprecated = true;

    paths[op.path] ??= {};
    (paths[op.path] as Record<HttpMethod, unknown>)[op.method] = operation;
  }

  const info: Record<string, unknown> = {
    title: options.openapi.info.title,
    version: options.openapi.info.version,
  };
  for (const key of ['summary', 'description', 'termsOfService', 'contact', 'license'] as const) {
    const value = options.openapi.info[key];
    if (value !== null && value !== undefined) info[key] = value;
  }

  const doc: OpenApiDocument = { openapi: '3.1.0', info, paths };
  if (options.openapi.servers.length > 0)
    doc.servers = options.openapi.servers.map((s) => ({ ...s }));
  if (options.openapi.tags.length > 0) doc.tags = options.openapi.tags.map((t) => ({ ...t }));
  const components: Record<string, unknown> = {};
  if (usesProblem) components.schemas = { [PROBLEM_SCHEMA_NAME]: PROBLEM_JSON_SCHEMA };
  if (Object.keys(options.securitySchemes).length > 0) {
    const names = Object.keys(options.securitySchemes).sort();
    components.securitySchemes = Object.fromEntries(
      names.map((n) => [n, options.securitySchemes[n]]),
    );
  }
  if (Object.keys(components).length > 0) doc.components = components;
  // JSON round-trip: detaches from frozen/shared inputs and drops undefined values.
  return JSON.parse(JSON.stringify(doc)) as OpenApiDocument;
}
