// ST-007 (S-07): AC-045 — synchronous ApiDocsConfigError before mounting any route.
import { describe, expect, it } from 'vitest';

import { ApiDocsConfigError } from '../../src/config/errors.js';
import { createApiDocs } from '../../src/serve/router.js';

describe('serve/config-error', () => {
  it.each([
    ['unknown key', { specPth: '/x' }, 'specPth'],
    ['invalid ui', { ui: 'redoc' }, 'ui'],
    ['invalid validateResponses', { validateResponses: 'maybe' }, 'validateResponses'],
    ['invalid specPath', { specPath: 'no-slash' }, 'specPath'],
  ])('%s throws ApiDocsConfigError naming the offending path', (_label, options, expectedPath) => {
    let caught: unknown;
    try {
      createApiDocs(options);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiDocsConfigError);
    const err = caught as ApiDocsConfigError;
    expect(err.message).toContain(expectedPath);
  });
});
