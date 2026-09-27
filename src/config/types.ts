// ST-002 (S-02): ApiDocsOptions type, OptionRow, OptionPath, and the structural
// SchemaAdapter port (ADR-38). Per ADR-21/ADR-04: this file never imports `zod`
// or `src/adapter/**`; the schema adapter shape is duck-typed, not a value import.

/**
 * ADR-38: structural (duck-typed) port for a schema adapter. `src/config/**`
 * never imports a concrete adapter — callers pass any object satisfying this
 * shape (the real check at runtime is duck-typed in `validate.ts`).
 */
export interface SchemaAdapter {
  isSchema(value: unknown): boolean;
  validate(schema: unknown, data: unknown): unknown;
  toJSONSchema(schema: unknown): unknown;
}

export interface OpenApiInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiTag {
  name: string;
  description?: string;
}

export interface OpenApiOptions {
  info?: OpenApiInfo;
  servers?: OpenApiServer[];
  tags?: OpenApiTag[];
}

export interface DocsOptions {
  specUrl?: string;
}

export interface AutoDetectFilter {
  include?: string[];
  exclude?: string[];
}

export interface DetectedDefaultResponse {
  status: number;
  description: string;
}

export interface SecurityRequirement {
  [scheme: string]: string[];
}

export interface OperationIdStrategyInput {
  method: string;
  path: string;
}

export type OperationIdStrategy = (input: OperationIdStrategyInput) => string;
export type TagStrategy = (input: OperationIdStrategyInput) => string[];
export type OnValidationError = (error: unknown) => { status: number; body: unknown };

export interface ApiDocsOptions {
  specPath?: string;
  docsPath?: string;
  ui?: 'scalar' | 'swagger-ui';
  cdnUrl?: string;
  serveSpec?: boolean;
  serveDocs?: boolean;
  docs?: DocsOptions;
  openapi?: OpenApiOptions;
  securitySchemes?: Record<string, unknown>;
  security?: SecurityRequirement[];
  validateRequests?: boolean;
  validateResponses?: false | 'warn' | 'error';
  onValidationError?: OnValidationError;
  autoDetect?: boolean | AutoDetectFilter;
  detectedDefaultResponse?: DetectedDefaultResponse;
  operationIdStrategy?: OperationIdStrategy;
  tagStrategy?: TagStrategy;
  schemaAdapter?: SchemaAdapter | null;
}

/** Per-route override options (ADR-38: `meta.adapter` merges via ST-004, not here). */
export type RouteOptions = Partial<ApiDocsOptions>;

/**
 * The top-level keys whose value is a "group": a plain namespacing object
 * expanded one level into dotted `OptionPath` entries (`docs.specUrl`,
 * `openapi.info`, ...). Every other key — including object-shaped leaves like
 * `schemaAdapter` or `securitySchemes` — is a path in its own right. This is a
 * closed, hand-maintained list (not a structural check) because a structural
 * "is this a plain data object" test cannot reliably tell a namespacing
 * object apart from a dictionary-shaped leaf like `securitySchemes`.
 */
type GroupKeyNames = 'docs' | 'openapi';

/**
 * ADR-04: dotted-path union over every leaf of `ApiDocsOptions`. `OPTION_SPEC`
 * is locked to this type via `satisfies Record<OptionPath<ApiDocsOptions>,
 * OptionRow>` so adding a key to `ApiDocsOptions` (top-level, or nested under
 * a group) without adding a matching table row — or vice versa — fails `tsc`.
 */
export type OptionPath<T> = {
  [K in keyof T & string]: K extends GroupKeyNames ? `${K}.${Extract<keyof NonNullable<T[K]>, string>}` : K;
}[keyof T & string];

export interface OptionRow {
  readonly path: string;
  readonly default: unknown;
  readonly check: (value: unknown) => boolean;
  readonly allowed?: string;
  readonly description: string;
}
