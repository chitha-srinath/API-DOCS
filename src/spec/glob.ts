/** Minimal path globs: `*` matches within one segment, `**` across segments. */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] as string;
    if (char === '*' && glob[i + 1] === '*') {
      // A trailing `/**` also matches the prefix itself: `/internal/**` matches `/internal`.
      if (i + 2 === glob.length && source.endsWith('/')) source = `${source.slice(0, -1)}(?:/.*)?`;
      else source += '.*';
      i += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else {
      source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(path));
}
