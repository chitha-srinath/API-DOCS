import type { LayerLike } from './recorder.js';

/**
 * Recover an Express 4 mount prefix from `layer.regexp`, for mounts made before the
 * recorder was installed. Returns `undefined` when the regexp is not a plain prefix.
 */
export function prefixFromRegexp(layer: LayerLike): string | undefined {
  const regexp = layer.regexp;
  if (!(regexp instanceof RegExp)) return undefined;
  if (regexp.fast_slash) return '';
  const match = /^\^(.*)\\\/\?\(\?=\\\/\|\$\)$/.exec(regexp.source);
  if (!match) return undefined;
  let body = match[1] as string;
  const keys = layer.keys ?? [];
  let index = 0;
  body = body.replace(/\(\?:\\\/\(\[\^\\?\/\]\+\?\)\)(\?)?/g, (_m, optional?: string) => {
    const key = keys[index++];
    return key ? `/:${String(key.name)}${optional ? '?' : ''}` : '\u0000';
  });
  if (body.includes('\u0000') || index !== keys.length) return undefined;
  const unescaped = body.replace(/\\([/.\-_~])/g, '$1');
  if (/[\\^$()[\]{}*+?|]/.test(unescaped.replace(/:[\w$]+\??/g, ''))) return undefined;
  return unescaped;
}
