// ST-007 (S-07): `express-api-docs/manual` — the opt-out entry. Re-exports the
// identical public API as `.` (ADR-24) WITHOUT the `./auto-record` side
// effect, so callers must call `installRecorder(express)` themselves.

export { ApiDocsConfigError } from './config/errors.js';
export { ApiDocsSchemaError } from './adapter/errors.js';
export { DEFAULT_OPTIONS } from './config/defaults.js';
export { standardSchemaAdapter } from './adapter/standard.js';
export { installRecorder } from './introspect/recorder.js';
export { createApiDocs } from './serve/router.js';

export type { ApiDocsInstance, GetSpecContext } from './serve/router.js';
export type {
  ApiDocsOptions,
  AutoDetectFilter,
  DetectedDefaultResponse,
  OnValidationError,
  OpenApiInfo,
  OpenApiOptions,
  OpenApiServer,
  OpenApiTag,
  OperationIdStrategy,
  OperationIdStrategyInput,
  OptionPath,
  OptionRow,
  RouteOptions,
  SchemaAdapter,
  SecurityRequirement,
  TagStrategy,
} from './config/types.js';
export type { RouteFn, RouteMeta, TypedRequestHandler } from './route/typed.js';
export type { DescribeFn } from './route/describe.js';
export type { OpenApiDocument, SpecOperation } from './spec/build.js';
export type {
  DetectedOperation,
  HttpMethod,
  Logger,
  OperationMeta,
  RegistryEntry,
  RouteRegistry,
} from './core/types.js';
