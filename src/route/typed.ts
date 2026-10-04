// ST-004 (S-04, component C3): `route()`, the typed-route factory. Per-route
// options and the schema adapter are resolved once, at definition time
// (ADR-03). The returned tuple `[validator, wrapAsync(handler)]` is meant to
// be spread straight into an Express method: `router.post(path, ...route(...))`.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { memoizeAdapter } from '../adapter/memo.js';
import { standardSchemaAdapter } from '../adapter/standard.js';
import type { Infer, SchemaAdapter } from '../adapter/types.js';
import { DEFAULT_OPTIONS } from '../config/defaults.js';
import { mergeOptions } from '../config/merge.js';
import type { ApiDocsOptions } from '../config/types.js';
import type { HttpMethod, Logger, OperationMeta, RouteRegistry } from '../core/types.js';
import { META } from '../core/types.js';
import { wrapAsync } from './async.js';
import type { OnValidationErrorHook } from './validate-request.js';
import { createRequestValidator } from './validate-request.js';
import { wrapResponseValidation } from './validate-response.js';

export interface RouteMeta<PS = undefined, QS = undefined, BS = undefined, RS = undefined> extends OperationMeta {
  params?: PS;
  query?: QS;
  body?: BS;
  response?: RS;
  /** ADR-38: a per-route schema adapter override, resolved before `options.schemaAdapter`. */
  adapter?: SchemaAdapter<unknown>;
  validateRequests?: boolean;
  validateResponses?: false | 'warn' | 'error';
  onValidationError?: OnValidationErrorHook;
}

// Falls back to plain Express's own defaults when a given schema is absent,
// so an un-typed slot (e.g. no `query` schema) keeps its normal Express shape
// instead of widening to `unknown` (which `Request`'s generics reject).
type ParamsOf<PS> = PS extends undefined ? Record<string, string> : Infer<PS>;
type QueryOf<QS> = QS extends undefined ? Record<string, string | string[] | undefined> : Infer<QS>;
type BodyOf<BS> = BS extends undefined ? unknown : Infer<BS>;

export type TypedRequestHandler<TParams, TQuery, TBody> = (
  req: Request<TParams, unknown, TBody, TQuery>,
  res: Response,
  next: NextFunction,
) => unknown;

export interface RouteFactoryDeps {
  readonly registry: RouteRegistry;
  readonly options: ApiDocsOptions;
  readonly logger: Logger;
}

function resolveRouteOptions(
  globalOptions: ApiDocsOptions,
  meta: RouteMeta<unknown, unknown, unknown, unknown>,
): ApiDocsOptions {
  const routeOverrides: Partial<ApiDocsOptions> = {};
  if (meta.validateRequests !== undefined) routeOverrides.validateRequests = meta.validateRequests;
  if (meta.validateResponses !== undefined) routeOverrides.validateResponses = meta.validateResponses;
  if (meta.onValidationError !== undefined) routeOverrides.onValidationError = meta.onValidationError;
  return mergeOptions(DEFAULT_OPTIONS as ApiDocsOptions, globalOptions, routeOverrides);
}

// F-04 fix (QA fix loop iteration 1): the resolved adapter is wrapped in
// `memoizeAdapter` (ADR-03) so repeated `toJSONSchema` calls on the same
// schema identity (e.g. across spec rebuilds) hit the adapter at most once.
export function resolveAdapter(
  globalOptions: ApiDocsOptions,
  meta: RouteMeta<unknown, unknown, unknown, unknown>,
  logger?: Logger,
): SchemaAdapter<unknown> {
  const raw: SchemaAdapter<unknown> = meta.adapter
    ? meta.adapter
    : globalOptions.schemaAdapter
      ? (globalOptions.schemaAdapter as unknown as SchemaAdapter<unknown>)
      : (standardSchemaAdapter as unknown as SchemaAdapter<unknown>);
  return memoizeAdapter(raw, logger);
}

function tagMeta(fn: RequestHandler, tag: { source: 'typed'; method: HttpMethod; meta: OperationMeta }): void {
  (fn as unknown as Record<PropertyKey, unknown>)[META] = tag;
}

export type RouteFn = <PS = undefined, QS = undefined, BS = undefined, RS = undefined>(
  method: HttpMethod,
  localPath: string,
  meta: RouteMeta<PS, QS, BS, RS>,
  handler: TypedRequestHandler<ParamsOf<PS>, QueryOf<QS>, BodyOf<BS>>,
) => [RequestHandler, RequestHandler];

export function createRoute(deps: RouteFactoryDeps): RouteFn {
  return function route<PS = undefined, QS = undefined, BS = undefined, RS = undefined>(
    method: HttpMethod,
    localPath: string,
    meta: RouteMeta<PS, QS, BS, RS>,
    handler: TypedRequestHandler<ParamsOf<PS>, QueryOf<QS>, BodyOf<BS>>,
  ): [RequestHandler, RequestHandler] {
    const metaUnknown = meta as unknown as RouteMeta<unknown, unknown, unknown, unknown>;
    const effective = resolveRouteOptions(deps.options, metaUnknown);
    const adapter = resolveAdapter(deps.options, metaUnknown, deps.logger);

    const validator = createRequestValidator({
      schemas: { params: meta.params, query: meta.query, body: meta.body },
      adapter,
      validateRequests: effective.validateRequests ?? true,
      onValidationError: effective.onValidationError as OnValidationErrorHook | undefined,
    });

    const rawHandler = handler as unknown as RequestHandler;
    const responseValidated = wrapResponseValidation(rawHandler, {
      schema: meta.response,
      adapter,
      mode: effective.validateResponses ?? false,
      logger: deps.logger,
    });

    const wrappedHandler = wrapAsync(responseValidated);

    tagMeta(validator, { source: 'typed', method, meta });
    tagMeta(wrappedHandler, { source: 'typed', method, meta });

    deps.registry.register({
      method,
      localPath,
      source: 'typed',
      meta,
      validatorFn: validator,
      handlerFn: wrappedHandler,
    });

    return [validator, wrappedHandler];
  };
}
