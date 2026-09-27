import { DEFAULT_OPTIONS } from './defaults.js';
import { ApiDocsConfigError } from './errors.js';
import { mergeOptions } from './merge.js';
import { BOOLEAN_SHORTHANDS, OPTION_SPEC, isPlainObject, type OptionRow } from './spec-table.js';
import type { ApiDocsOptions, ResolvedOptions, RouteOptions } from './types.js';

const ROWS: Readonly<Record<string, OptionRow>> = OPTION_SPEC;

/** Every dotted prefix that is an option group, e.g. `openapi`, `openapi.info`. */
const GROUPS: ReadonlySet<string> = new Set(
  Object.keys(ROWS).flatMap((path) => {
    const segments = path.split('.');
    return segments.slice(1).map((_, i) => segments.slice(0, i + 1).join('.'));
  }),
);

function childKeys(prefix: string): string[] {
  const keys = new Set<string>();
  for (const path of [...Object.keys(ROWS), ...GROUPS]) {
    if (prefix === '') keys.add(path.split('.')[0] as string);
    else if (path.startsWith(`${prefix}.`))
      keys.add(path.slice(prefix.length + 1).split('.')[0] as string);
  }
  return [...keys].sort();
}

function describeValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return 'an array';
  if (value === null) return 'null';
  if (typeof value === 'function') return 'a function';
  if (typeof value === 'object') return 'an object';
  return String(value);
}

function checkRow(path: string, value: unknown): void {
  const row = ROWS[path] as OptionRow;
  if (!row.check(value)) {
    throw new ApiDocsConfigError(
      path,
      row.allowed,
      `Invalid option "${path}": expected ${row.allowed}, received ${describeValue(value)}.`,
    );
  }
}

function visit(value: Record<string, unknown>, prefix: string): void {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child === undefined) continue;
    if (path in ROWS) {
      checkRow(path, child);
    } else if (GROUPS.has(path)) {
      const shorthand = BOOLEAN_SHORTHANDS[path];
      if (shorthand && typeof child === 'boolean') continue;
      if (!isPlainObject(child)) {
        const expected = shorthand
          ? `boolean or an object with keys ${childKeys(path).join(', ')}`
          : `an object with keys ${childKeys(path).join(', ')}`;
        throw new ApiDocsConfigError(
          path,
          expected,
          `Invalid option "${path}": expected ${expected}, received ${describeValue(child)}.`,
        );
      }
      visit(child, path);
    } else {
      const allowed = childKeys(prefix);
      const where = prefix ? ` in "${prefix}"` : '';
      throw new ApiDocsConfigError(
        path,
        `one of ${allowed.join(', ')}`,
        `Unknown option "${path}". Allowed keys${where}: ${allowed.join(', ')}.`,
      );
    }
  }
}

/** Replace boolean shorthands (e.g. `autoDetect: false`) with their object form. */
export function normalizeOptions(options: ApiDocsOptions): Record<string, unknown> {
  const out: Record<string, unknown> = { ...options };
  for (const [group, key] of Object.entries(BOOLEAN_SHORTHANDS)) {
    if (typeof out[group] === 'boolean') out[group] = { [key]: out[group] };
  }
  return out;
}

/**
 * Throws `ApiDocsConfigError` synchronously for an unknown key, an invalid value, or
 * `serveSpec: false` + `serveDocs: true` without `docs.specUrl` (A-9).
 */
export function validateOptions(options: unknown): void {
  if (options === undefined) return;
  if (!isPlainObject(options)) {
    throw new ApiDocsConfigError(
      'options',
      'a plain object',
      `Invalid options: expected a plain object, received ${describeValue(options)}.`,
    );
  }
  visit(options, '');
  const docs = isPlainObject(options.docs) ? options.docs : {};
  const serveSpec = options.serveSpec ?? DEFAULT_OPTIONS.serveSpec;
  const serveDocs = options.serveDocs ?? DEFAULT_OPTIONS.serveDocs;
  if (!serveSpec && serveDocs && (docs.specUrl === undefined || docs.specUrl === null)) {
    throw new ApiDocsConfigError(
      'serveSpec',
      'docs.specUrl to be set when serveSpec is false and serveDocs is true',
      'Option "serveSpec" is false while "serveDocs" is true, but "docs.specUrl" is not set, ' +
        'so the docs UI would have no spec to load. Set "docs.specUrl" or "serveDocs: false".',
    );
  }
}

/** Validate, normalize and merge user options over `DEFAULT_OPTIONS`. */
export function resolveOptions(options?: ApiDocsOptions): ResolvedOptions {
  validateOptions(options);
  return mergeOptions(
    DEFAULT_OPTIONS as unknown as ResolvedOptions,
    normalizeOptions(options ?? {}),
  );
}

const ROUTE_OPTION_KEYS = [
  'tags',
  'security',
  'validateRequests',
  'validateResponses',
  'onValidationError',
] as const satisfies ReadonlyArray<keyof RouteOptions>;

/** Validate the option keys a route may override; other keys are ignored. */
export function validateRouteOptions(options: RouteOptions): void {
  for (const key of ROUTE_OPTION_KEYS) {
    if (options[key] !== undefined) checkRow(key, options[key]);
  }
}

/** Effective options for one route: per-route over global over defaults. */
export function resolveRouteOptions(global: ResolvedOptions, route: RouteOptions): ResolvedOptions {
  validateRouteOptions(route);
  const picked: Record<string, unknown> = {};
  for (const key of ROUTE_OPTION_KEYS) picked[key] = route[key];
  return mergeOptions(global, picked);
}
