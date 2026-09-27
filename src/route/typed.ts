import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Infer, SchemaAdapter } from '../adapter/types.js';
import { ApiDocsConfigError } from '../config/errors.js';
import { isPlainObject } from '../config/spec-table.js';
import type { ResolvedOptions, RouteOptions } from '../config/types.js';
import { resolveRouteOptions } from '../config/validate.js';
import {
  META,
  type HandlerTag,
  type Logger,
  type OperationMeta,
  type ResponseSpec,
  type ResponsesMap,
  type RouteRegistry,
} from '../core/types.js';
import { wrapAsync } from './async.js';
import { createRequestValidator, type RequestSchemas } from './validate-request.js';
import { installResponseValidation } from './validate-response.js';

type DocFields = Omit<OperationMeta, 'params' | 'query' | 'headers' | 'body' | 'responses'>;

/** A typed route: documentation, schemas and per-route option overrides. */
export interface RouteDefinition<
  P = undefined,
  Q = undefined,
  H = undefined,
  B = undefined,
  R = undefined,
>
  extends DocFields, RouteOptions {
  params?: P;
  query?: Q;
  headers?: H;
  body?: B;
  /** Status code (or `default`) to a schema, or to `{ description, schema, contentType }`. */
  responses?: R;
}

type ResponseSchemaBody<V> = V extends { readonly '~standard': unknown }
  ? Infer<V>
  : V extends ResponseSpec<infer S>
    ? [S] extends [undefined]
      ? never
      : Infer<S>
    : Infer<V>;
type ResponseBodies<R> = R extends object
  ? { [K in keyof R]: ResponseSchemaBody<R[K]> }[keyof R]
  : never;
type NeverTo<T, Fallback> = [T] extends [never] ? Fallback : T;

/** The response body type: a union of every declared response schema's output. */
export type ResponseBody<R> = NeverTo<ResponseBodies<R>, unknown>;

export type TypedRequest<P, Q, B, R> = Request<
  [P] extends [undefined] ? Request['params'] : Infer<P>,
  ResponseBody<R>,
  [B] extends [undefined] ? unknown : Infer<B>,
  [Q] extends [undefined] ? Request['query'] : Infer<Q>
>;

export type TypedHandler<P, Q, _H, B, R> = (
  req: TypedRequest<P, Q, B, R>,
  res: Response<ResponseBody<R>>,
  next: NextFunction,
) => unknown;

export type RouteHandlers = [validator: RequestHandler, handler: RequestHandler];

export interface RouteContext {
  registry: RouteRegistry;
  adapter: SchemaAdapter;
  logger: Logger;
  options: ResolvedOptions;
}

const SCHEMA_KEYS = ['params', 'query', 'headers', 'body'] as const;

/** The schema of one `responses` entry, or `undefined` for a description-only entry. */
export function responseSchemaOf(value: unknown, adapter: SchemaAdapter): unknown {
  if (adapter.isSchema(value)) return value;
  if (isPlainObject(value)) return (value as ResponseSpec).schema;
  return undefined;
}

function checkSchemas(
  def: RouteDefinition<unknown, unknown, unknown, unknown, unknown>,
  adapter: SchemaAdapter,
): void {
  for (const key of SCHEMA_KEYS) {
    if (def[key] !== undefined && !adapter.isSchema(def[key])) {
      throw new ApiDocsConfigError(
        `route.${key}`,
        `a schema supported by the "${adapter.name}" adapter`,
        `Route option "${key}" is not a schema the "${adapter.name}" adapter supports.`,
      );
    }
  }
  if (def.responses !== undefined && !isPlainObject(def.responses)) {
    throw new ApiDocsConfigError('route.responses', 'an object keyed by status code');
  }
  for (const [status, value] of Object.entries((def.responses ?? {}) as ResponsesMap)) {
    const schema = responseSchemaOf(value, adapter);
    if (!(status === 'default' || /^[1-5]\d\d$/.test(status))) {
      throw new ApiDocsConfigError(`route.responses.${status}`, 'an HTTP status code or "default"');
    }
    if (schema !== undefined && !adapter.isSchema(schema)) {
      throw new ApiDocsConfigError(
        `route.responses.${status}`,
        `a schema supported by the "${adapter.name}" adapter, or { description, schema }`,
      );
    }
  }
}

export function toOperationMeta(def: object): OperationMeta {
  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(def)) {
    if (value === undefined) continue;
    if (['validateRequests', 'validateResponses', 'onValidationError'].includes(key)) continue;
    meta[key] = value;
  }
  return meta as OperationMeta;
}

export function tagHandler(fn: RequestHandler, tag: HandlerTag): void {
  Object.defineProperty(fn, META, { value: tag, enumerable: false });
}

/**
 * Build the typed-route helper for one `createApiDocs()` instance. The returned
 * `[validator, handler]` pair is spread into a normal Express route:
 * `router.post('/users', ...route({ body }, handler))`.
 */
export function createRoute(ctx: RouteContext) {
  return function route<P = undefined, Q = undefined, H = undefined, B = undefined, R = undefined>(
    def: RouteDefinition<P, Q, H, B, R>,
    handler: TypedHandler<P, Q, H, B, R>,
  ): RouteHandlers {
    const loose = def as RouteDefinition<unknown, unknown, unknown, unknown, unknown>;
    checkSchemas(loose, ctx.adapter);
    const opts = resolveRouteOptions(ctx.options, loose);
    const meta = toOperationMeta(loose);
    const label =
      def.method && def.path
        ? `${def.method.toUpperCase()} ${def.path}`
        : def.operationId
          ? `operation "${def.operationId}"`
          : 'a typed route';

    const responseSchemas = new Map<string, unknown>();
    for (const [status, value] of Object.entries((def.responses ?? {}) as ResponsesMap)) {
      const schema = responseSchemaOf(value, ctx.adapter);
      if (schema !== undefined) responseSchemas.set(status, schema);
    }
    const mode = opts.validateResponses;
    const onPass =
      mode !== false && responseSchemas.size > 0
        ? (_req: Request, res: Response) =>
            installResponseValidation(res, {
              schemas: responseSchemas,
              mode,
              adapter: ctx.adapter,
              logger: ctx.logger,
              label,
            })
        : undefined;

    const schemas: RequestSchemas = opts.validateRequests
      ? { params: def.params, query: def.query, headers: def.headers, body: def.body }
      : {};
    const validator = createRequestValidator({
      schemas,
      adapter: ctx.adapter,
      onValidationError: opts.onValidationError,
      onPass,
    });
    const wrapped = wrapAsync(
      handler as unknown as (req: Request, res: Response, next: NextFunction) => unknown,
    );

    const tag: HandlerTag = { source: 'typed', meta };
    tagHandler(validator, tag);
    tagHandler(wrapped, tag);
    ctx.registry.register({
      method: def.method,
      localPath: def.path,
      source: 'typed',
      meta,
      validatorFn: validator,
      handlerFn: wrapped,
    });
    return [validator, wrapped];
  };
}
