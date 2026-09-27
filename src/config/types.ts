import type { Request } from 'express';
import type { HttpMethod, Logger, SecurityRequirement, ValidationIssue } from '../core/types.js';

export type UiKind = 'scalar' | 'swagger-ui';
export type ResponseValidationMode = false | 'warn' | 'error';

/** What an `onValidationError` hook returns: replaces the default 400 problem+json. */
export interface ValidationErrorResponse {
  status: number;
  body: unknown;
  /** Defaults to `application/json` for objects. */
  contentType?: string;
}

export type OnValidationError = (
  issues: ValidationIssue[],
  req: Request,
) => ValidationErrorResponse;

export interface OperationNamingInput {
  method: HttpMethod;
  /** OpenAPI path template, e.g. `/users/{id}`. */
  path: string;
  /** Express path, e.g. `/users/:id`. */
  expressPath: string;
  source: 'typed' | 'describe' | 'plain';
}

export type OperationIdStrategy = (op: OperationNamingInput) => string;
export type TagStrategy = (op: OperationNamingInput) => string[];

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, { default: string; enum?: string[]; description?: string }>;
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: { url: string; description?: string };
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  identifier?: string;
  url?: string;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export type SecuritySchemeObject =
  | { type: 'http'; scheme: string; bearerFormat?: string; description?: string }
  | { type: 'apiKey'; name: string; in: 'query' | 'header' | 'cookie'; description?: string }
  | {
      type: 'oauth2';
      flows: {
        implicit?: OAuthFlow;
        password?: OAuthFlow;
        clientCredentials?: OAuthFlow;
        authorizationCode?: OAuthFlow;
      };
      description?: string;
    }
  | { type: 'openIdConnect'; openIdConnectUrl: string; description?: string }
  | { type: 'mutualTLS'; description?: string };

/**
 * A pluggable schema adapter. Typed loosely here so `config/**` never depends on
 * `adapter/**` (ADR-04); the full contract is `SchemaAdapter` in `adapter/types.ts`.
 */
export interface AdapterLike {
  readonly name: string;
  isSchema(value: unknown): boolean;
  validate(schema: never, input: unknown): unknown;
  toJSONSchema(schema: never, io: 'input' | 'output', ctx?: never): unknown;
}

/** The fully resolved configuration: every key present. `DEFAULT_OPTIONS` has this shape. */
export interface ResolvedOptions {
  specPath: string;
  docsPath: string;
  serveSpec: boolean;
  serveDocs: boolean;
  ui: UiKind;
  cdnUrl: string | null;
  docs: {
    specUrl: string | null;
    title: string | null;
  };
  openapi: {
    info: {
      title: string;
      version: string;
      description: string | null;
      summary: string | null;
      termsOfService: string | null;
      contact: ContactObject | null;
      license: LicenseObject | null;
    };
    servers: ServerObject[];
    tags: TagObject[];
  };
  securitySchemes: Record<string, SecuritySchemeObject>;
  security: SecurityRequirement[];
  tags: string[];
  validateRequests: boolean;
  validateResponses: ResponseValidationMode;
  onValidationError: OnValidationError | null;
  autoDetect: {
    enabled: boolean;
    include: string[];
    exclude: string[];
  };
  detectedDefaultResponse: {
    status: number;
    description: string;
  };
  operationIdStrategy: OperationIdStrategy | null;
  tagStrategy: TagStrategy | null;
  adapter: AdapterLike | null;
  logger: Logger | null;
}

/**
 * Options for `createApiDocs(options)`. Every key is optional; omitted keys take the
 * value in `DEFAULT_OPTIONS`.
 */
export interface ApiDocsOptions {
  /** Path of the JSON spec endpoint. Must start with `/`. */
  specPath?: string;
  /** Path of the docs UI endpoint. Must start with `/`. */
  docsPath?: string;
  /** Serve the JSON spec endpoint. */
  serveSpec?: boolean;
  /** Serve the docs UI endpoint. */
  serveDocs?: boolean;
  /** Docs UI to render. */
  ui?: UiKind;
  /** Override the pinned CDN URL (Scalar: script URL; Swagger UI: `swagger-ui-dist` base URL). */
  cdnUrl?: string | null;
  docs?: {
    /** URL the docs UI loads the spec from. Required when `serveSpec` is false. */
    specUrl?: string | null;
    /** HTML page title. Defaults to `openapi.info.title`. */
    title?: string | null;
  };
  openapi?: {
    info?: {
      title?: string;
      version?: string;
      description?: string | null;
      summary?: string | null;
      termsOfService?: string | null;
      contact?: ContactObject | null;
      license?: LicenseObject | null;
    };
    servers?: ServerObject[];
    tags?: TagObject[];
  };
  /** Security schemes, declared once; referenced by name from `security`. */
  securitySchemes?: Record<string, SecuritySchemeObject>;
  /** Global security requirement, inherited by every operation without its own. */
  security?: SecurityRequirement[];
  /** Tags applied to every operation that declares none. Empty uses `tagStrategy`. */
  tags?: string[];
  /** Validate params, query, headers and body of typed routes. */
  validateRequests?: boolean;
  /** Validate typed-route responses: off, log a warning, or replace with a 500. */
  validateResponses?: ResponseValidationMode;
  /** Replace the default 400 problem+json response. */
  onValidationError?: OnValidationError | null;
  /** Auto-detect plain Express routes. `true`/`false` is shorthand for `{ enabled }`. */
  autoDetect?:
    | boolean
    | {
        enabled?: boolean;
        include?: string[];
        exclude?: string[];
      };
  /** Response documented for auto-detected routes. */
  detectedDefaultResponse?: {
    status?: number;
    description?: string;
  };
  operationIdStrategy?: OperationIdStrategy | null;
  tagStrategy?: TagStrategy | null;
  /** Schema adapter. `null` uses the built-in Standard Schema adapter. */
  adapter?: AdapterLike | null;
  /** Logger for warnings and debug lines. `null` uses `console.warn` for warnings. */
  logger?: Logger | null;
}

/** Options a single route may override. */
export interface RouteOptions {
  tags?: string[];
  security?: SecurityRequirement[];
  validateRequests?: boolean;
  validateResponses?: ResponseValidationMode;
  onValidationError?: OnValidationError | null;
}

type Leaf = string | number | boolean | null | undefined | ((...args: never[]) => unknown);
type IsLeaf<V> = [V] extends [Leaf]
  ? true
  : null extends V
    ? true
    : V extends readonly unknown[]
      ? true
      : string extends keyof V
        ? true
        : false;

/** Dotted paths of every leaf option, e.g. `'openapi.info.title'`. */
export type OptionPath<T> = {
  [K in keyof T & string]-?: IsLeaf<T[K]> extends true ? K : `${K}.${OptionPath<T[K]>}`;
}[keyof T & string];
