import type { OptionPath, ResolvedOptions } from './types.js';

export interface OptionRow {
  /** The default value. Objects and arrays are frozen when `DEFAULT_OPTIONS` is built. */
  readonly default: unknown;
  /** Runtime check for a user-supplied value (`undefined` never reaches it). */
  readonly check: (value: unknown) => boolean;
  /** Human-readable allowed values or type, used in `ApiDocsConfigError`. */
  readonly allowed: string;
  /** One-line description, mirrored in the README defaults table. */
  readonly description: string;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isFunction = (v: unknown): boolean => typeof v === 'function';
export const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
};
const orNull =
  (check: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    v === null || check(v);
const isAbsolutePath = (v: unknown): boolean => isString(v) && v.startsWith('/') && !/\s/.test(v);
const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every(isString);
const isGlobArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((g) => isString(g) && g.startsWith('/'));
const hasStringKey = (v: unknown, key: string): boolean =>
  isPlainObject(v) && isString(v[key]) && v[key] !== '';

const SCHEME_TYPES = ['apiKey', 'http', 'oauth2', 'openIdConnect', 'mutualTLS'];
const isSecurityScheme = (v: unknown): boolean => {
  if (!isPlainObject(v) || !SCHEME_TYPES.includes(v.type as string)) return false;
  switch (v.type) {
    case 'http':
      return hasStringKey(v, 'scheme');
    case 'apiKey':
      return hasStringKey(v, 'name') && ['query', 'header', 'cookie'].includes(v.in as string);
    case 'oauth2':
      return isPlainObject(v.flows);
    case 'openIdConnect':
      return hasStringKey(v, 'openIdConnectUrl');
    default:
      return true;
  }
};
const isSecurityRequirements = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every(
    (req) => isPlainObject(req) && Object.values(req).every((scopes) => isStringArray(scopes)),
  );
const isLogger = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  isFunction((v as Record<string, unknown>).warn) &&
  isFunction((v as Record<string, unknown>).debug);
const isAdapter = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  isString((v as Record<string, unknown>).name) &&
  isFunction((v as Record<string, unknown>).isSchema) &&
  isFunction((v as Record<string, unknown>).validate) &&
  isFunction((v as Record<string, unknown>).toJSONSchema);

/**
 * The single runtime source for every option: default, check, allowed values and
 * description. Compile-time locked to `ResolvedOptions`: adding a key to the type
 * without a row here (or the reverse) fails `tsc`.
 */
export const OPTION_SPEC = {
  specPath: {
    default: '/openapi.json',
    check: isAbsolutePath,
    allowed: 'a path string starting with "/"',
    description: 'Path of the OpenAPI JSON endpoint.',
  },
  docsPath: {
    default: '/docs',
    check: isAbsolutePath,
    allowed: 'a path string starting with "/"',
    description: 'Path of the docs UI endpoint.',
  },
  serveSpec: {
    default: true,
    check: isBoolean,
    allowed: 'boolean',
    description: 'Serve the JSON spec endpoint.',
  },
  serveDocs: {
    default: true,
    check: isBoolean,
    allowed: 'boolean',
    description: 'Serve the docs UI endpoint.',
  },
  ui: {
    default: 'scalar',
    check: (v) => v === 'scalar' || v === 'swagger-ui',
    allowed: '"scalar" | "swagger-ui"',
    description: 'Docs UI, loaded from a version-pinned CDN.',
  },
  cdnUrl: {
    default: null,
    check: orNull(isString),
    allowed: 'string URL or null',
    description:
      'Override the pinned CDN URL (Scalar: script URL; Swagger UI: swagger-ui-dist base URL).',
  },
  'docs.specUrl': {
    default: null,
    check: orNull(isString),
    allowed: 'string URL or null',
    description: 'URL the docs UI loads the spec from; required when `serveSpec` is false.',
  },
  'docs.title': {
    default: null,
    check: orNull(isString),
    allowed: 'string or null',
    description: 'HTML title of the docs page; null uses `openapi.info.title`.',
  },
  'openapi.info.title': {
    default: 'API',
    check: isString,
    allowed: 'string',
    description: 'Spec `info.title`.',
  },
  'openapi.info.version': {
    default: '0.0.0',
    check: isString,
    allowed: 'string',
    description: 'Spec `info.version`.',
  },
  'openapi.info.description': {
    default: null,
    check: orNull(isString),
    allowed: 'string or null',
    description: 'Spec `info.description`; omitted when null.',
  },
  'openapi.info.summary': {
    default: null,
    check: orNull(isString),
    allowed: 'string or null',
    description: 'Spec `info.summary`; omitted when null.',
  },
  'openapi.info.termsOfService': {
    default: null,
    check: orNull(isString),
    allowed: 'string URL or null',
    description: 'Spec `info.termsOfService`; omitted when null.',
  },
  'openapi.info.contact': {
    default: null,
    check: orNull(isPlainObject),
    allowed: 'contact object or null',
    description: 'Spec `info.contact`; omitted when null.',
  },
  'openapi.info.license': {
    default: null,
    check: orNull((v) => hasStringKey(v, 'name')),
    allowed: 'license object with a "name" or null',
    description: 'Spec `info.license`; omitted when null.',
  },
  'openapi.servers': {
    default: [],
    check: (v) => Array.isArray(v) && v.every((s) => hasStringKey(s, 'url')),
    allowed: 'array of server objects with a "url"',
    description: 'Spec `servers`; omitted when empty.',
  },
  'openapi.tags': {
    default: [],
    check: (v) => Array.isArray(v) && v.every((t) => hasStringKey(t, 'name')),
    allowed: 'array of tag objects with a "name"',
    description: 'Spec `tags`; omitted when empty.',
  },
  securitySchemes: {
    default: {},
    check: (v) => isPlainObject(v) && Object.values(v).every(isSecurityScheme),
    allowed: 'record of OpenAPI security scheme objects (apiKey, http, oauth2, ...)',
    description: 'Security schemes, declared once (`components.securitySchemes`).',
  },
  security: {
    default: [],
    check: isSecurityRequirements,
    allowed: 'array of security requirement objects, e.g. [{ bearer: [] }]',
    description: 'Global security requirement; routes without `security` inherit it.',
  },
  tags: {
    default: [],
    check: isStringArray,
    allowed: 'array of strings',
    description: 'Tags for operations that declare none; empty uses `tagStrategy`.',
  },
  validateRequests: {
    default: true,
    check: isBoolean,
    allowed: 'boolean',
    description: 'Validate params, query, headers and body of typed routes.',
  },
  validateResponses: {
    default: false,
    check: (v) => v === false || v === 'warn' || v === 'error',
    allowed: 'false | "warn" | "error"',
    description: 'Validate typed-route responses: off, log one warning, or send a 500.',
  },
  onValidationError: {
    default: null,
    check: orNull(isFunction),
    allowed: 'function (issues, req) => { status, body } or null',
    description: 'Replace the default 400 problem+json response.',
  },
  'autoDetect.enabled': {
    default: true,
    check: isBoolean,
    allowed: 'boolean',
    description: 'Auto-detect plain routes by walking the router stack.',
  },
  'autoDetect.include': {
    default: [],
    check: isGlobArray,
    allowed: 'array of path globs starting with "/" (`*`, `**`)',
    description: 'Only auto-detect plain routes matching these globs; empty includes all.',
  },
  'autoDetect.exclude': {
    default: [],
    check: isGlobArray,
    allowed: 'array of path globs starting with "/" (`*`, `**`)',
    description: 'Never auto-detect plain routes matching these globs.',
  },
  'detectedDefaultResponse.status': {
    default: 200,
    check: (v) => Number.isInteger(v) && (v as number) >= 100 && (v as number) <= 599,
    allowed: 'integer HTTP status 100-599',
    description: 'Status of the response documented for auto-detected routes.',
  },
  'detectedDefaultResponse.description': {
    default: 'OK',
    check: isString,
    allowed: 'string',
    description: 'Description of the response documented for auto-detected routes.',
  },
  operationIdStrategy: {
    default: null,
    check: orNull(isFunction),
    allowed: 'function (op) => string or null',
    description: 'Custom operationId; null gives `getUsersById` style.',
  },
  tagStrategy: {
    default: null,
    check: orNull(isFunction),
    allowed: 'function (op) => string[] or null',
    description: 'Custom tags; null uses the first static path segment.',
  },
  adapter: {
    default: null,
    check: orNull(isAdapter),
    allowed: 'SchemaAdapter object or null',
    description: 'Schema adapter; null uses the built-in Standard Schema adapter.',
  },
  logger: {
    default: null,
    check: orNull(isLogger),
    allowed: 'object with debug() and warn() or null',
    description: 'Logger for warnings; null writes warnings to `console.warn`.',
  },
} as const satisfies Record<OptionPath<ResolvedOptions>, OptionRow>;

export type OptionSpecPath = keyof typeof OPTION_SPEC;

/** Groups whose value may be given as a boolean shorthand for `<group>.enabled`. */
export const BOOLEAN_SHORTHANDS: Readonly<Record<string, string>> = {
  autoDetect: 'enabled',
};
