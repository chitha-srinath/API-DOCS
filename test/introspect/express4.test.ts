import { describe, expect, it } from 'vitest';
import { prefixFromRegexp } from '../../src/introspect/express4.js';
import { majors } from '../fixtures/majors.js';

const v4 = majors.find((m) => m.major === 4);

describe.skipIf(!v4)('Express 4 prefix recovery from layer.regexp', () => {
  function lastLayer(path: string) {
    const app = v4!.express();
    // Bypass the recorder: call the router's original stack push path via a fresh router.
    app.use(path, v4!.express.Router());
    const stack = (app as any)._router.stack;
    return stack[stack.length - 1];
  }

  it.each([
    ['/api', '/api'],
    ['/v1/:org', '/v1/:org'],
    ['/a.b/c-d', '/a.b/c-d'],
    ['/', ''],
  ])('%s -> %s', (mount, prefix) => {
    expect(prefixFromRegexp(lastLayer(mount))).toBe(prefix);
  });

  it('returns undefined for unrecoverable regexps', () => {
    expect(prefixFromRegexp({})).toBeUndefined();
    expect(prefixFromRegexp({ regexp: /^\/a+\/?(?=\/|$)/i })).toBeUndefined();
    expect(prefixFromRegexp({ regexp: /^\/x/ })).toBeUndefined();
    expect(
      prefixFromRegexp({ regexp: /^\/v(?:\/([^/]+?))\/?(?=\/|$)/i, keys: [] }),
    ).toBeUndefined();
  });
});
