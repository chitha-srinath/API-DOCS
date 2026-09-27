/**
 * Shared contracts. No logic lives here.
 *
 * Values that cross module boundaries (and the ESM/CJS dual-package boundary) use
 * `Symbol.for`, so both copies of the package agree on them.
 */
import type { RequestHandler } from 'express';

export const META: unique symbol = Symbol.for('express-api-docs.meta') as never;
export const MOUNT: unique symbol = Symbol.for('express-api-docs.mount') as never;
export const CHILD: unique symbol = Symbol.for('express-api-docs.child') as never;
export const RECORDER: unique symbol = Symbol.for('express-api-docs.recorder') as never;

export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Where a request value came from; matches the OpenAPI `in` vocabulary. */
export type RequestLocation = 'path' | 'query' | 'header' | 'body';

/** One entry of a route's `responses` map: a bare schema or a described response. */
export interface ResponseSpec<S = unknown> {
  description?: string;
  schema?: S;
  /** Media type of the body. Defaults to `application/json`. */
  contentType?: string;
}

export type ResponsesMap = Partial<Record<number | `${number}` | 'default', unknown>>;

/** Security requirement object, e.g. `{ bearer: [] }`. */
export type SecurityRequirement = Record<string, string[]>;

/** Per-route documentation metadata, shared by typed and `describe()` routes. */
export interface OperationMeta {
  /** HTTP method; optional because the stack walk supplies it. */
  method?: HttpMethod;
  /** Express path as declared on its router; optional because the stack walk supplies it. */
  path?: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirement[];
  params?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
  /** Media type of the request body. Defaults to `application/json`. */
  bodyContentType?: string;
  responses?: ResponsesMap;
}

/** Tag stored on typed and `describe()` handlers under `[META]`. */
export interface HandlerTag {
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
}

/** Tag stored on the package's own spec/docs handlers so the walk skips them. */
export interface InternalTag {
  readonly internal: true;
}

export interface DetectedOperation {
  readonly method: HttpMethod;
  /** Full Express path, including mount prefixes. */
  readonly expressPath: string;
  /** OpenAPI path template, e.g. `/users/{id}`. */
  readonly path: string;
  readonly pathParams: readonly string[];
  readonly source: 'typed' | 'describe' | 'plain';
  readonly meta?: OperationMeta;
  /** Registry entry id when the operation came from this instance's registry. */
  readonly entryId?: number;
  /** Discovery order, used to keep output stable. */
  readonly order: number;
}

export type LogCode =
  | 'EAD_RECORDER_NOT_INSTALLED'
  | 'EAD_RECORDER_AUTO_FAILED'
  | 'EAD_MOUNTED_IN_SUBAPP'
  | 'EAD_LAYER_UNRECOGNISED'
  | 'EAD_LAYER_THREW'
  | 'EAD_MOUNT_UNRECOVERABLE'
  | 'EAD_SUBAPP_UNRECORDED'
  | 'EAD_REGISTRY_UNLOCATED'
  | 'EAD_ROUTE_SKIPPED'
  | 'EAD_RESPONSE_INVALID'
  | 'EAD_SCHEMA_NO_JSONSCHEMA'
  | 'EAD_SCHEMA_NOT_OBJECT'
  | 'EAD_ASYNC_SCHEMA';

export interface LogDetails {
  code: LogCode;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, details?: LogDetails): void;
  warn(message: string, details?: LogDetails): void;
}

export interface RegistryEntry {
  /** Registration order, used for operationId collision suffixes. */
  readonly id: number;
  readonly method?: HttpMethod;
  /** Express syntax, as declared (when known at declaration time). */
  readonly localPath?: string;
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
  /** Typed routes only. */
  readonly validatorFn?: RequestHandler;
  readonly handlerFn: RequestHandler;
}

export interface RouteRegistry {
  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry;
  /** Registration order. */
  entries(): readonly RegistryEntry[];
  /** Identity match on `validatorFn` OR `handlerFn`. */
  findByHandle(fn: unknown): RegistryEntry | undefined;
}

/** One request-validation failure, as it appears in the problem+json `errors[]`. */
export interface ValidationIssue {
  in: RequestLocation;
  /** Dotted path inside the location, e.g. `user.tags.0`; empty for the root. */
  path: string;
  message: string;
}
