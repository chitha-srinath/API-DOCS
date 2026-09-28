// ST-007 (S-07): the main entry. Per ADR-24/ADR-40, the import-time side
// effect (installing the recorder on the resolved Express copy) is isolated
// in its own tsup entry; this bare import is the only reference to it here.
import './auto-record';

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
  DocsOptions,
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
