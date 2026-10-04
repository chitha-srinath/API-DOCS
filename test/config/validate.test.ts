import { describe, expect, it } from 'vitest';
import { ApiDocsConfigError } from '../../src/config/errors.js';
import { validateOptions } from '../../src/config/validate.js';

const stubAdapter = {
  isSchema: () => true,
  validate: () => ({ ok: true }),
  toJSONSchema: () => ({}),
};

describe('config/validate: validateOptions', () => {
  it('rejects unknown key specPth', () => {
    expect(() => validateOptions({ specPth: '/x' })).toThrow(ApiDocsConfigError);
    try {
      validateOptions({ specPth: '/x' });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain('specPth');
    }
  });


  it("rejects validateResponses 'maybe'", () => {
    try {
      validateOptions({ validateResponses: 'maybe' });
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('validateResponses');
      expect(message).toContain('warn');
      expect(message).toContain('error');
    }
  });

  it("rejects specPath 'no-slash'", () => {
    try {
      validateOptions({ specPath: 'no-slash' });
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('specPath');
      expect(message).toContain('starts with "/"');
    }
  });

  it('rejects nested unknown key openapi.infoo', () => {
    try {
      validateOptions({ openapi: { infoo: {} } });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain('openapi.infoo');
    }
  });




  it('schemaAdapter: accepts null', () => {
    expect(() => validateOptions({ schemaAdapter: null })).not.toThrow();
  });

  it('schemaAdapter: accepts a duck-typed object with isSchema, validate, toJSONSchema', () => {
    expect(() => validateOptions({ schemaAdapter: stubAdapter })).not.toThrow();
  });

  it('schemaAdapter: rejects a string / {} / missing toJSONSchema / non-function validate', () => {
    for (const bad of [
      'zod',
      {},
      { isSchema: () => true, validate: () => ({}) },
      { isSchema: () => true, validate: 'nope', toJSONSchema: () => ({}) },
    ]) {
      try {
        validateOptions({ schemaAdapter: bad });
        expect.unreachable();
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('schemaAdapter');
        expect(message).toContain('isSchema');
        expect(message).toContain('validate');
        expect(message).toContain('toJSONSchema');
      }
    }
  });

  it('accepts empty options', () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  it('accepts a full valid options object', () => {
    expect(() =>
      validateOptions({
        specPath: '/openapi.json',
        serveSpec: true,
        openapi: {
          info: { title: 'My API', version: '1.0.0', description: 'desc' },
          servers: [{ url: 'https://api.example.com' }],
          tags: [{ name: 'users' }],
        },
        securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
        security: [{ bearer: [] }],
        validateRequests: false,
        validateResponses: 'warn',
        onValidationError: () => ({ status: 400, body: {} }),
        autoDetect: { include: ['/api/**'], exclude: ['/internal/**'] },
        detectedDefaultResponse: { status: 204, description: 'No Content' },
        operationIdStrategy: () => 'opId',
        tagStrategy: () => ['tag'],
        schemaAdapter: stubAdapter,
      }),
    ).not.toThrow();
  });

  it('throws synchronously (not a rejected promise) and exposes path/expected', () => {
    let threw = false;
    try {
      validateOptions({ validateRequests: 'yes' });
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ApiDocsConfigError);
      const configError = err as ApiDocsConfigError;
      expect(configError.path).toBe('validateRequests');
      expect(typeof configError.expected).toBe('string');
    }
    expect(threw).toBe(true);
  });
});
