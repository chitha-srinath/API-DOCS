import { describe, expect, it } from 'vitest';
import { ApiDocsConfigError } from '../../src/config/errors.js';
import { resolveOptions, resolveRouteOptions, validateOptions } from '../../src/config/validate.js';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import type { ApiDocsOptions, ResolvedOptions } from '../../src/config/types.js';

function errorOf(fn: () => unknown): ApiDocsConfigError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiDocsConfigError);
    return error as ApiDocsConfigError;
  }
  throw new Error('expected a throw');
}

describe('validateOptions (AC-045)', () => {
  it('rejects unknown key specPth', () => {
    const error = errorOf(() => validateOptions({ specPth: '/x' }));
    expect(error.message).toContain('specPth');
    expect(error.message).toContain('specPath');
    expect(error.path).toBe('specPth');
  });

  it("rejects ui 'redoc' naming both allowed values", () => {
    const error = errorOf(() => validateOptions({ ui: 'redoc' }));
    expect(error.message).toContain('ui');
    expect(error.message).toContain('scalar');
    expect(error.message).toContain('swagger-ui');
    expect(error.message).toContain('"redoc"');
    expect(error.path).toBe('ui');
    expect(error.expected).toBe('"scalar" | "swagger-ui"');
  });

  it("rejects validateResponses 'maybe'", () => {
    const error = errorOf(() => validateOptions({ validateResponses: 'maybe' }));
    expect(error.message).toContain('validateResponses');
    expect(error.message).toContain('warn');
    expect(error.message).toContain('error');
  });

  it("rejects specPath 'no-slash'", () => {
    const error = errorOf(() => validateOptions({ specPath: 'no-slash' }));
    expect(error.message).toContain('specPath');
    expect(error.message).toContain('starting with "/"');
  });

  it('rejects a nested unknown key with its dotted path', () => {
    const error = errorOf(() => validateOptions({ openapi: { infoo: {} } }));
    expect(error.path).toBe('openapi.infoo');
    expect(error.message).toContain('Allowed keys in "openapi": info, servers, tags');
  });

  it('rejects a non-object group', () => {
    const error = errorOf(() => validateOptions({ openapi: 'x' }));
    expect(error.path).toBe('openapi');
    expect(error.message).toContain('an object with keys info, servers, tags');
  });

  it('rejects a non-boolean, non-object autoDetect', () => {
    const error = errorOf(() => validateOptions({ autoDetect: 'yes' }));
    expect(error.path).toBe('autoDetect');
    expect(error.message).toContain('boolean or an object');
  });

  it('rejects non-object options', () => {
    expect(errorOf(() => validateOptions('x')).path).toBe('options');
    expect(errorOf(() => validateOptions([])).message).toContain('an array');
  });

  it.each([
    [{ serveSpec: 'yes' }, 'serveSpec', '"yes"'],
    [{ cdnUrl: 5 }, 'cdnUrl', '5'],
    [{ docs: { specUrl: {} } }, 'docs.specUrl', 'an object'],
    [{ openapi: { info: { title: 1 } } }, 'openapi.info.title', '1'],
    [{ openapi: { info: { license: {} } } }, 'openapi.info.license', 'an object'],
    [{ openapi: { servers: [{}] } }, 'openapi.servers', 'an array'],
    [{ openapi: { tags: [{ name: '' }] } }, 'openapi.tags', 'an array'],
    [{ securitySchemes: { a: { type: 'http' } } }, 'securitySchemes', 'an object'],
    [
      { securitySchemes: { a: { type: 'apiKey', name: 'k', in: 'body' } } },
      'securitySchemes',
      'an object',
    ],
    [{ securitySchemes: { a: { type: 'oauth2' } } }, 'securitySchemes', 'an object'],
    [{ securitySchemes: { a: { type: 'openIdConnect' } } }, 'securitySchemes', 'an object'],
    [{ securitySchemes: { a: { type: 'basic' } } }, 'securitySchemes', 'an object'],
    [{ securitySchemes: [] }, 'securitySchemes', 'an array'],
    [{ security: [{ bearer: 'x' }] }, 'security', 'an array'],
    [{ security: {} }, 'security', 'an object'],
    [{ tags: [1] }, 'tags', 'an array'],
    [{ validateRequests: 'yes' }, 'validateRequests', '"yes"'],
    [{ onValidationError: 'x' }, 'onValidationError', '"x"'],
    [{ autoDetect: { include: ['api/**'] } }, 'autoDetect.include', 'an array'],
    [{ autoDetect: { exclude: 'x' } }, 'autoDetect.exclude', '"x"'],
    [{ detectedDefaultResponse: { status: 99 } }, 'detectedDefaultResponse.status', '99'],
    [{ detectedDefaultResponse: { status: 200.5 } }, 'detectedDefaultResponse.status', '200.5'],
    [{ detectedDefaultResponse: { status: 600 } }, 'detectedDefaultResponse.status', '600'],
    [{ operationIdStrategy: true }, 'operationIdStrategy', 'true'],
    [{ tagStrategy: [] }, 'tagStrategy', 'an array'],
    [{ adapter: {} }, 'adapter', 'an object'],
    [{ adapter: { name: 'x', isSchema() {}, validate() {} } }, 'adapter', 'an object'],
    [{ logger: { warn() {} } }, 'logger', 'an object'],
    [{ logger: 'console' }, 'logger', '"console"'],
    [{ docsPath: '/has space' }, 'docsPath', '"/has space"'],
  ])('rejects %j at %s', (options, path, received) => {
    const error = errorOf(() => validateOptions(options));
    expect(error.path).toBe(path);
    expect(error.message).toContain(`"${path}"`);
    expect(error.message).toContain(`received ${received}`);
  });

  it('A-9: serveSpec false + serveDocs true without docs.specUrl throws', () => {
    const error = errorOf(() => validateOptions({ serveSpec: false }));
    expect(error.path).toBe('serveSpec');
    expect(error.message).toContain('serveSpec');
    expect(error.message).toContain('docs.specUrl');
    expect(() =>
      validateOptions({ serveSpec: false, serveDocs: true, docs: { specUrl: null } }),
    ).toThrow(ApiDocsConfigError);
  });

  it('A-9: docs.specUrl set, or serveDocs false, does not throw', () => {
    expect(() =>
      validateOptions({ serveSpec: false, docs: { specUrl: 'https://x/o.json' } }),
    ).not.toThrow();
    expect(() => validateOptions({ serveSpec: false, serveDocs: false })).not.toThrow();
  });

  it('accepts empty and undefined options', () => {
    expect(() => validateOptions(undefined)).not.toThrow();
    expect(() => validateOptions({})).not.toThrow();
    expect(() => validateOptions({ specPath: undefined })).not.toThrow();
  });

  it('accepts a full valid options object', () => {
    const full: ApiDocsOptions = {
      specPath: '/spec.json',
      docsPath: '/reference',
      serveSpec: true,
      serveDocs: true,
      ui: 'swagger-ui',
      cdnUrl: 'https://cdn.example.com/swagger',
      docs: { specUrl: null, title: 'Docs' },
      openapi: {
        info: {
          title: 'T',
          version: '1',
          description: 'd',
          summary: 's',
          termsOfService: 'https://x',
          contact: { name: 'c' },
          license: { name: 'MIT' },
        },
        servers: [{ url: 'https://api.example.com' }],
        tags: [{ name: 'users' }],
      },
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
        key: { type: 'apiKey', name: 'X-Key', in: 'header' },
        oauth: {
          type: 'oauth2',
          flows: { clientCredentials: { tokenUrl: 'https://t', scopes: {} } },
        },
        oidc: { type: 'openIdConnect', openIdConnectUrl: 'https://o' },
        mtls: { type: 'mutualTLS' },
      },
      security: [{ bearer: [] }],
      tags: ['a'],
      validateRequests: false,
      validateResponses: 'error',
      onValidationError: () => ({ status: 422, body: {} }),
      autoDetect: { enabled: true, include: ['/api/**'], exclude: ['/internal/**'] },
      detectedDefaultResponse: { status: 204, description: 'No Content' },
      operationIdStrategy: () => 'id',
      tagStrategy: () => ['t'],
      adapter: {
        name: 'stub',
        isSchema: () => true,
        validate: () => ({}),
        toJSONSchema: () => ({}),
      },
      logger: { debug() {}, warn() {} },
    };
    expect(() => validateOptions(full)).not.toThrow();
    expect(() => validateOptions({ autoDetect: false })).not.toThrow();
  });

  it('throws synchronously with name, path and expected', () => {
    let thrown: unknown;
    try {
      resolveOptions({ ui: 'redoc' } as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe('ApiDocsConfigError');
    expect((thrown as ApiDocsConfigError).expected).toBe('"scalar" | "swagger-ui"');
  });

  it('ApiDocsConfigError has a default message', () => {
    const error = new ApiDocsConfigError('a.b', 'string');
    expect(error.message).toBe('Invalid option "a.b": expected string.');
  });
});

describe('resolveOptions', () => {
  it('zero options deep-equal DEFAULT_OPTIONS', () => {
    expect(resolveOptions()).toEqual(DEFAULT_OPTIONS);
  });

  it('normalizes the autoDetect boolean shorthand', () => {
    expect(resolveOptions({ autoDetect: false }).autoDetect).toEqual({
      enabled: false,
      include: [],
      exclude: [],
    });
    expect(resolveOptions({ autoDetect: true }).autoDetect.enabled).toBe(true);
    expect(resolveOptions({ autoDetect: { exclude: ['/x/**'] } }).autoDetect).toEqual({
      enabled: true,
      include: [],
      exclude: ['/x/**'],
    });
  });
});

describe('resolveRouteOptions (AC-044 c, d)', () => {
  const global = resolveOptions({ validateResponses: 'warn', tags: ['a', 'b'] }) as ResolvedOptions;

  it('per-route validateResponses beats global', () => {
    expect(resolveRouteOptions(global, { validateResponses: 'error' }).validateResponses).toBe(
      'error',
    );
    expect(resolveRouteOptions(global, {}).validateResponses).toBe('warn');
  });

  it('per-route onValidationError beats global', () => {
    const globalHook = () => ({ status: 400, body: 'g' });
    const routeHook = () => ({ status: 400, body: 'r' });
    const withGlobal = resolveOptions({ onValidationError: globalHook });
    expect(
      resolveRouteOptions(withGlobal, { onValidationError: routeHook }).onValidationError,
    ).toBe(routeHook);
    expect(resolveRouteOptions(withGlobal, {}).onValidationError).toBe(globalHook);
  });

  it('per-route tags replace global tags', () => {
    expect(resolveRouteOptions(global, { tags: ['c'] }).tags).toEqual(['c']);
  });

  it('validates per-route option values', () => {
    expect(() => resolveRouteOptions(global, { validateResponses: 'maybe' } as never)).toThrow(
      /validateResponses/,
    );
  });
});
