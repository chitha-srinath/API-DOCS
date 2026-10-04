// ST-002 (S-02): the OPTION_SPEC table (component C1). ADR-04: locked to
// `ApiDocsOptions` via `satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>` —
// adding/removing a key on either side fails `tsc`.
import type { ApiDocsOptions, OptionPath, OptionRow } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDuckTypedSchemaAdapter(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof (value as Record<string, unknown>).isSchema === 'function' &&
    typeof (value as Record<string, unknown>).validate === 'function' &&
    typeof (value as Record<string, unknown>).toJSONSchema === 'function'
  );
}

export const OPTION_SPEC = {
  specPath: {
    path: 'specPath',
    default: '/openapi.json',
    check: (v: unknown) => typeof v === 'string' && v.startsWith('/'),
    allowed: 'a string that starts with "/"',
    description: 'the path the generated OpenAPI document is served from',
  },
  serveSpec: {
    path: 'serveSpec',
    default: true,
    check: (v: unknown) => typeof v === 'boolean',
    allowed: 'a boolean',
    description: 'whether the spec endpoint is mounted',
  },
  docsPath: {
    path: 'docsPath',
    default: '/docs',
    check: (v: unknown) => typeof v === 'string' && v.startsWith('/'),
    allowed: 'a string that starts with "/"',
    description: 'the path the rendered API docs UI is served from',
  },
  serveDocs: {
    path: 'serveDocs',
    default: true,
    check: (v: unknown) => typeof v === 'boolean',
    allowed: 'a boolean',
    description: 'whether the rendered API docs UI is mounted',
  },
  'openapi.info': {
    path: 'openapi.info',
    default: undefined,
    check: (v: unknown) =>
      v === undefined ||
      (isPlainObject(v) &&
        (v.title === undefined || typeof v.title === 'string') &&
        (v.version === undefined || typeof v.version === 'string') &&
        (v.description === undefined || typeof v.description === 'string')),
    allowed: 'an object with optional string title, version and description',
    description: 'OpenAPI info overrides',
  },
  'openapi.servers': {
    path: 'openapi.servers',
    default: undefined,
    check: (v: unknown) =>
      v === undefined || (Array.isArray(v) && v.every((s) => isPlainObject(s) && typeof s.url === 'string')),
    allowed: 'an array of { url, description? }',
    description: 'OpenAPI servers list',
  },
  'openapi.tags': {
    path: 'openapi.tags',
    default: undefined,
    check: (v: unknown) =>
      v === undefined || (Array.isArray(v) && v.every((t) => isPlainObject(t) && typeof t.name === 'string')),
    allowed: 'an array of { name, description? }',
    description: 'OpenAPI tag definitions',
  },
  securitySchemes: {
    path: 'securitySchemes',
    default: undefined,
    check: (v: unknown) => v === undefined || isPlainObject(v),
    allowed: 'an object of named security schemes',
    description: 'OpenAPI securitySchemes map',
  },
  security: {
    path: 'security',
    default: undefined,
    check: (v: unknown) => v === undefined || (Array.isArray(v) && v.every((r) => isPlainObject(r))),
    allowed: 'an array of security requirement objects',
    description: 'global OpenAPI security requirement',
  },
  validateRequests: {
    path: 'validateRequests',
    default: true,
    check: (v: unknown) => typeof v === 'boolean',
    allowed: 'a boolean',
    description: 'whether typed routes validate requests (A-7)',
  },
  validateResponses: {
    path: 'validateResponses',
    default: false,
    check: (v: unknown) => v === false || v === 'warn' || v === 'error',
    allowed: "false, 'warn' or 'error'",
    description: 'whether/how typed routes validate responses',
  },
  onValidationError: {
    path: 'onValidationError',
    default: undefined,
    check: (v: unknown) => v === undefined || typeof v === 'function',
    allowed: 'a function',
    description: 'a formatter invoked when request validation fails',
  },
  autoDetect: {
    path: 'autoDetect',
    default: true,
    check: (v: unknown) =>
      typeof v === 'boolean' ||
      (isPlainObject(v) &&
        (v.include === undefined || isStringArray(v.include)) &&
        (v.exclude === undefined || isStringArray(v.exclude))),
    allowed: 'a boolean or { include?: string[], exclude?: string[] }',
    description: 'plain-route auto-detection (A-1)',
  },
  detectedDefaultResponse: {
    path: 'detectedDefaultResponse',
    default: undefined,
    check: (v: unknown) =>
      v === undefined || (isPlainObject(v) && typeof v.status === 'number' && typeof v.description === 'string'),
    allowed: 'an object with a numeric status and a string description',
    description: 'the default response synthesized for auto-detected operations',
  },
  operationIdStrategy: {
    path: 'operationIdStrategy',
    default: undefined,
    check: (v: unknown) => v === undefined || typeof v === 'function',
    allowed: 'a function',
    description: 'a custom operationId generator (A-3)',
  },
  tagStrategy: {
    path: 'tagStrategy',
    default: undefined,
    check: (v: unknown) => v === undefined || typeof v === 'function',
    allowed: 'a function',
    description: 'a custom tag generator (A-4)',
  },
  schemaAdapter: {
    path: 'schemaAdapter',
    default: null,
    check: (v: unknown) => v === null || isDuckTypedSchemaAdapter(v),
    allowed: 'null or an object with function members isSchema, validate and toJSONSchema',
    description: 'the global schema adapter (ADR-38); null means the core default',
  },
} satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>;
