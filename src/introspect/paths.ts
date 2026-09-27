/** Express path syntax to OpenAPI path templates, per Express major. */

export type ExpressMajor = 4 | 5;

export interface ConvertedPath {
  /** OpenAPI template, e.g. `/users/{id}`. */
  path: string;
  params: string[];
}

export type PathConversion =
  | { ok: true; paths: ConvertedPath[] }
  | { ok: false; reason: 'regexp' | 'unnamed-wildcard' | 'unsupported' };

/** Join two Express paths: `('/api', '/users/:id')` gives `/api/users/:id`. */
export function joinPaths(prefix: string, path: string): string {
  return normalizePath(`${prefix}/${path}`);
}

/** Collapse duplicate slashes and drop a trailing slash (except for the root). */
export function normalizePath(path: string): string {
  const collapsed = `/${path}`.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

const NAME = '[A-Za-z_$][\\w$]*';

/** Expand Express 5 optional groups: `/a{/:b}` gives `/a` and `/a/:b`. Supports nesting. */
export function expandOptionalGroups(path: string): string[] | undefined {
  let variants = [''];
  let i = 0;
  while (i < path.length) {
    const char = path[i] as string;
    if (char === '\\') {
      const escaped = path.slice(i, i + 2);
      variants = variants.map((v) => v + escaped);
      i += 2;
    } else if (char === '{') {
      let depth = 1;
      let j = i + 1;
      while (j < path.length && depth > 0) {
        if (path[j] === '\\') j += 1;
        else if (path[j] === '{') depth += 1;
        else if (path[j] === '}') depth -= 1;
        j += 1;
      }
      if (depth !== 0) return undefined;
      const inner = expandOptionalGroups(path.slice(i + 1, j - 1));
      if (!inner) return undefined;
      variants = variants.flatMap((v) => [v, ...inner.map((inside) => v + inside)]);
      i = j;
    } else if (char === '}') {
      return undefined;
    } else {
      variants = variants.map((v) => v + char);
      i += 1;
    }
  }
  return variants;
}

function unescape(path: string): string {
  return path.replace(/\\(.)/g, '$1');
}

function finish(path: string, params: string[]): ConvertedPath {
  return { path: normalizePath(path), params };
}

function convertV5(path: string): PathConversion {
  const variants = expandOptionalGroups(path);
  if (!variants) return { ok: false, reason: 'unsupported' };
  const paths: ConvertedPath[] = [];
  for (const variant of variants) {
    const params: string[] = [];
    const replaced = variant.replace(
      new RegExp(`(?<!\\\\)([:*])(?:(${NAME})|"((?:[^"\\\\]|\\\\.)+)")`, 'g'),
      (_m, _kind: string, plain?: string, quoted?: string) => {
        const name = plain ?? unescape(quoted as string);
        params.push(name);
        return `{${name}}`;
      },
    );
    const stripped = replaced.replace(/\\./g, '');
    if (stripped.includes('*')) return { ok: false, reason: 'unnamed-wildcard' };
    if (/[:()[\]?+!]/.test(stripped)) return { ok: false, reason: 'unsupported' };
    paths.push(finish(unescape(replaced), params));
  }
  return { ok: true, paths };
}

function convertV4(path: string): PathConversion {
  if (path.includes('*')) return { ok: false, reason: 'unnamed-wildcard' };
  const segments = path.split('/');
  let variants: Array<{ parts: string[]; params: string[] }> = [{ parts: [], params: [] }];
  const paramRe = new RegExp(`:(${NAME})(\\((?:[^()\\\\]|\\\\.)*\\))?(\\?)?`, 'g');
  for (const segment of segments) {
    const optional = new RegExp(`^:(${NAME})(\\((?:[^()\\\\]|\\\\.)*\\))?\\?$`).exec(segment);
    if (optional) {
      const name = optional[1] as string;
      variants = variants.flatMap((v) => [
        v,
        { parts: [...v.parts, `{${name}}`], params: [...v.params, name] },
      ]);
      continue;
    }
    const names: string[] = [];
    let invalid = false;
    const converted = segment.replace(paramRe, (_m, name: string, _re, opt?: string) => {
      if (opt) invalid = true;
      names.push(name);
      return `{${name}}`;
    });
    if (invalid || /[()[\]?+]/.test(converted.replace(/\{[^}]*\}/g, ''))) {
      return { ok: false, reason: 'unsupported' };
    }
    variants = variants.map((v) => ({
      parts: [...v.parts, converted],
      params: [...v.params, ...names],
    }));
  }
  return { ok: true, paths: variants.map((v) => finish(v.parts.join('/'), v.params)) };
}

/** Convert one Express route path. RegExp paths and unnamed wildcards cannot be converted. */
export function convertPath(path: unknown, major: ExpressMajor): PathConversion {
  if (path instanceof RegExp) return { ok: false, reason: 'regexp' };
  if (typeof path !== 'string') return { ok: false, reason: 'unsupported' };
  return major === 4 ? convertV4(path) : convertV5(path);
}
