// ST-005 (S-05), AC-034: Express path syntax -> OpenAPI path templates.
// `:id` -> `{id}`; `/*rest` (v5 named wildcard) -> `{rest}`; `{/:id}` (v5
// optional segment) and `:id?` (v4 optional param) each expand into two
// paths. RegExp routes and the unnamed `*` wildcard are skipped with exactly
// one `debug` call and never throw. Pure function: two calls with the same
// input are deep-equal (determinism requirement).
import type { Logger } from '../core/types.js';

export interface ConvertedPath {
  path: string;
  pathParams: string[];
}

const NAMED_WILDCARD = /\*([A-Za-z_$][\w$]*)/;
const UNNAMED_WILDCARD = /(^|\/)\*(\/|$)/;
const OPTIONAL_SEGMENT = /\{\/:([A-Za-z_$][\w$]*)\}/;
const OPTIONAL_PARAM = /:([A-Za-z_$][\w$]*)\?/;
const NAMED_PARAM = /:([A-Za-z_$][\w$]*)/g;
const BRACED_PARAM = /\{([A-Za-z_$][\w$]*)\}/g;

function normalize(path: string): string {
  return path === '' ? '/' : path;
}

/**
 * Converts one Express-syntax local path into one or more OpenAPI path
 * templates. Returns `undefined` (after logging one `debug` line) for a
 * `RegExp` path or an unnamed `*` wildcard, which the spec expects to skip.
 */
export function convertExpressPath(raw: unknown, log: Logger): ConvertedPath[] | undefined {
  if (raw instanceof RegExp) {
    log.debug('EAD_REGEXP_PATH_SKIPPED', String(raw));
    return undefined;
  }
  if (typeof raw !== 'string') {
    log.debug('EAD_PATH_SKIPPED', String(raw));
    return undefined;
  }
  if (UNNAMED_WILDCARD.test(raw) && !NAMED_WILDCARD.test(raw)) {
    log.debug('EAD_WILDCARD_SKIPPED', raw);
    return undefined;
  }

  const optionalSegment = raw.match(OPTIONAL_SEGMENT);
  if (optionalSegment) {
    const token = optionalSegment[0];
    const name = optionalSegment[1] as string;
    const withSegment = raw.replace(token, `/{${name}}`);
    const withoutSegment = raw.replace(token, '');
    const withIt = convertExpressPath(normalize(withSegment), log);
    const withoutIt = convertExpressPath(normalize(withoutSegment), log);
    if (!withIt || !withoutIt) return undefined;
    return [...withIt, ...withoutIt];
  }

  const optionalParam = raw.match(OPTIONAL_PARAM);
  if (optionalParam) {
    const name = optionalParam[1] as string;
    const withParam = raw.replace(`:${name}?`, `{${name}}`);
    const withoutParam = raw.replace(`/:${name}?`, '').replace(`:${name}?`, '');
    const withIt = convertExpressPath(normalize(withParam), log);
    const withoutIt = convertExpressPath(normalize(withoutParam), log);
    if (!withIt || !withoutIt) return undefined;
    return [...withIt, ...withoutIt];
  }

  let converted = raw.replace(NAMED_WILDCARD, '{$1}');
  converted = converted.replace(NAMED_PARAM, (_match, name: string) => `{${name}}`);

  const pathParams: string[] = [];
  for (const match of converted.matchAll(BRACED_PARAM)) {
    const name = match[1] as string;
    if (!pathParams.includes(name)) pathParams.push(name);
  }

  return [{ path: converted, pathParams }];
}
