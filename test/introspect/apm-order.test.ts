import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { installRecorder } from '../../src/introspect/recorder.js';
import { createApiDocs } from '../../src/serve/router.js';
import { majors, spyLogger } from '../fixtures/majors.js';

const require = createRequire(import.meta.url);

function freshExpress(name: string): any {
  const drop = () => {
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`node_modules/${name}/`) || key.includes('node_modules/router/'))
        delete require.cache[key];
    }
  };
  drop();
  const fresh = require(name);
  drop();
  require(name);
  return fresh;
}

/** A third-party (APM-style) wrapper around `use` and around each new layer's handle. */
function apmWrap(express: any): void {
  let proto = Object.getPrototypeOf(express.Router());
  while (!Object.prototype.hasOwnProperty.call(proto, 'use')) proto = Object.getPrototypeOf(proto);
  const original = proto.use;
  proto.use = function apmUse(this: any, ...args: unknown[]) {
    const before = this.stack.length;
    const result = original.apply(this, args);
    for (const layer of this.stack.slice(before)) {
      const handle = layer.handle;
      layer.handle = function apmHandle(this: unknown, ...a: unknown[]) {
        return handle.apply(this, a);
      };
    }
    return result;
  };
}

describe.each(majors)('third-party use() wrappers on Express $major (CR-3)', ({ name }) => {
  for (const order of ['before', 'after'] as const) {
    it(`prefixes survive when the APM wrapper is installed ${order} the recorder`, () => {
      const express = freshExpress(name);
      if (order === 'before') {
        apmWrap(express);
        installRecorder(express);
      } else {
        installRecorder(express);
        apmWrap(express);
      }
      const logger = spyLogger();
      const api = createApiDocs({ logger });
      const app = express();
      const router = express.Router();
      router.get('/users/:id', (_q: any, r: any) => r.end());
      app.use('/api', router);
      expect(Object.keys(api.getSpec({ app }).paths)).toEqual(['/api/users/{id}']);
      expect(logger.count('warn')).toBe(0);
    });
  }
});
