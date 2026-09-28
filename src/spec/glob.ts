// ST-006 (S-06, component C6): in-house glob matcher (ADR-10). Supports only
// `*` (matches exactly one path segment, no `/`) and `**` (matches zero or
// more segments). There is no `picomatch` dependency.

const REGEXP_METACHARS = /[.+?^${}()|[\]\\]/g;

function escapeChar(char: string): string {
  return REGEXP_METACHARS.test(char) ? `\\${char}` : char;
}

function toRegExp(pattern: string): RegExp {
  let out = '';
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    if (pattern.startsWith('/**', i)) {
      // zero or more trailing segments: "/internal/**" also matches "/internal".
      out += '(?:/.*)?';
      i += 3;
    } else if (pattern.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
    } else {
      out += escapeChar(pattern[i] as string);
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Matches `path` against an in-house glob `pattern` supporting only `*` and `**`. */
export function matchGlob(pattern: string, path: string): boolean {
  return toRegExp(pattern).test(path);
}

/** `true` when `path` matches at least one pattern in `patterns`. */
export function matchAnyGlob(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => matchGlob(pattern, path));
}
