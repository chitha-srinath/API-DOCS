import { describe, expect, it } from 'vitest';
import { ApiDocsConfigError } from '../../src/config/errors.js';
import { BRAND, BRAND_KEY } from '../../src/core/types.js';

describe('config/errors: ApiDocsConfigError (ADR-49)', () => {
  it('class brand code: own static BRAND_KEY', () => {
    expect(Object.prototype.hasOwnProperty.call(ApiDocsConfigError, BRAND_KEY)).toBe(true);
    expect((ApiDocsConfigError as unknown as Record<symbol, string>)[BRAND_KEY]).toBe(
      'express-api-docs.v1.ApiDocsConfigError',
    );
  });

  it('instance carries the class-chain brand set, never err.name', () => {
    const err = new ApiDocsConfigError('specPath', 'a string');
    expect(Array.isArray((err as unknown as Record<symbol, unknown>)[BRAND])).toBe(true);
    expect((err as unknown as Record<symbol, string[]>)[BRAND]).toContain('express-api-docs.v1.ApiDocsConfigError');
    expect((err as unknown as Record<symbol, string[]>)[BRAND]).not.toContain(err.name);
  });

  it('Symbol.hasInstance: brand path recognizes a plain branded object', () => {
    const branded = { [BRAND]: ['express-api-docs.v1.ApiDocsConfigError'] };
    expect(branded).toBeInstanceOf(ApiDocsConfigError);
  });

  it('Symbol.hasInstance: rejects wrong brand, non-array brand, null, undefined, foreign Error', () => {
    expect({ [BRAND]: ['express-api-docs.v1.ApiDocsSchemaError'] }).not.toBeInstanceOf(ApiDocsConfigError);
    expect({ [BRAND]: 'express-api-docs.v1.ApiDocsConfigError' }).not.toBeInstanceOf(ApiDocsConfigError);
    expect(null).not.toBeInstanceOf(ApiDocsConfigError);
    expect(undefined).not.toBeInstanceOf(ApiDocsConfigError);
    expect(new Error('x')).not.toBeInstanceOf(ApiDocsConfigError);
  });

  it('subclass with its own brand: instance carries both codes and both instanceof checks pass', () => {
    class Sub extends ApiDocsConfigError {
      static readonly [BRAND_KEY] = 'test.Sub';
    }
    const sub = new Sub('x', 'y');
    const brands = (sub as unknown as Record<symbol, string[]>)[BRAND];
    expect(brands).toContain('test.Sub');
    expect(brands).toContain('express-api-docs.v1.ApiDocsConfigError');
    expect(sub).toBeInstanceOf(Sub);
    expect(sub).toBeInstanceOf(ApiDocsConfigError);
  });

  it('subclass without a brand falls back to a normal prototype instanceof check', () => {
    class Plain extends ApiDocsConfigError {}
    const plain = new Plain('x', 'y');
    expect(plain).toBeInstanceOf(Plain);
    expect(plain).toBeInstanceOf(ApiDocsConfigError);

    const bare = new ApiDocsConfigError('x', 'y');
    expect(bare).not.toBeInstanceOf(Plain);

    const branded = { [BRAND]: ['express-api-docs.v1.ApiDocsConfigError'] };
    expect(branded).not.toBeInstanceOf(Plain);
  });

  it('renamed class (const alias, redefined .name) still passes instanceof', () => {
    const Renamed = ApiDocsConfigError;
    expect(new Renamed('x', 'y')).toBeInstanceOf(ApiDocsConfigError);

    class Sub extends ApiDocsConfigError {
      static readonly [BRAND_KEY] = 'test.Renamed';
    }
    Object.defineProperty(Sub, 'name', { value: 'TotallyDifferentName' });
    expect(new Sub('x', 'y')).toBeInstanceOf(ApiDocsConfigError);
  });

  it('exposes a stable name and code, is a real Error, and exposes path/expected', () => {
    const err = new ApiDocsConfigError('ui', "'alpha' or 'beta'");
    expect(err.name).toBe('ApiDocsConfigError');
    expect(typeof err.code).toBe('string');
    expect(err).toBeInstanceOf(Error);
    expect(err.path).toBe('ui');
    expect(err.expected).toBe("'alpha' or 'beta'");
  });
});
