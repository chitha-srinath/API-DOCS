/**
 * Public API without the import-time recorder patch. Call `installRecorder(express)`
 * yourself before mounting routers.
 */
export { createApiDocs, type ApiDocs, type GetSpecOptions } from './serve/router.js';
export { DEFAULT_OPTIONS } from './config/defaults.js';
export { ApiDocsConfigError } from './config/errors.js';
export { ApiDocsSchemaError } from './adapter/errors.js';
export { standardSchemaAdapter } from './adapter/standard.js';
export { installRecorder } from './introspect/recorder.js';
export { PROBLEM_MEDIA_TYPE, type ProblemDetails } from './route/problem.js';
export type {
  ApiDocsOptions,
  ContactObject,
  LicenseObject,
  OnValidationError,
  OperationIdStrategy,
  OperationNamingInput,
  ResolvedOptions,
  ResponseValidationMode,
  RouteOptions,
  SecuritySchemeObject,
  ServerObject,
  TagObject,
  TagStrategy,
  UiKind,
  ValidationErrorResponse,
} from './config/types.js';
export type {
  Infer,
  JSONSchema,
  SchemaAdapter,
  SchemaContext,
  SchemaIssue,
  SchemaValidationResult,
} from './adapter/types.js';
export type { StandardSchemaV1 } from './adapter/standard-types.js';
export type {
  HttpMethod,
  LogCode,
  LogDetails,
  Logger,
  OperationMeta,
  ResponseSpec,
  SecurityRequirement,
  ValidationIssue,
} from './core/types.js';
export type {
  ResponseBody,
  RouteDefinition,
  RouteHandlers,
  TypedHandler,
  TypedRequest,
} from './route/typed.js';
export type { DescribeDefinition } from './route/describe.js';
export type { OpenApiDocument } from './spec/build.js';
