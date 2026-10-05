import { describe, expect, it } from 'vitest';
import { BRAND, BRAND_KEY } from '../../src/core/types.js';
import { ApiDocsSchemaError } from '../../src/adapter/errors.js';

describe('ApiDocsSchemaError (ADR-41, ADR-49)', () => {
  it('has a stable name, code, brand key and brand array', () => {
    const err = new ApiDocsSchemaError('acme');
    expect(err.name).toBe('ApiDocsSchemaError');
    expect(err.code).toBe('EAD_ASYNC_SCHEMA');
    expect((ApiDocsSchemaError as unknown as Record<PropertyKey, unknown>)[BRAND_KEY]).toBe(
      'express-api-contract.v1.ApiDocsSchemaError',
    );
    expect(Array.isArray((err as unknown as Record<PropertyKey, unknown>)[BRAND])).toBe(true);
    expect((err as unknown as Record<PropertyKey, unknown>)[BRAND]).toContain(
      'express-api-contract.v1.ApiDocsSchemaError',
    );
  });

  it('is instanceof ApiDocsSchemaError and Error', () => {
    const err = new ApiDocsSchemaError('acme');
    expect(err instanceof ApiDocsSchemaError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('brand-checks plain objects structurally', () => {
    const branded = { [BRAND]: ['express-api-contract.v1.ApiDocsSchemaError'] };
    const wrongBrand = { [BRAND]: ['express-api-contract.v1.ApiDocsConfigError'] };
    const nonArrayBrand = { [BRAND]: 'express-api-contract.v1.ApiDocsSchemaError' };

    const nullish: unknown = null;
    const notDefined: unknown = undefined;

    expect(branded instanceof ApiDocsSchemaError).toBe(true);
    expect(wrongBrand instanceof ApiDocsSchemaError).toBe(false);
    expect(nonArrayBrand instanceof ApiDocsSchemaError).toBe(false);
    expect(nullish instanceof ApiDocsSchemaError).toBe(false);
    expect(notDefined instanceof ApiDocsSchemaError).toBe(false);
    expect(new Error() instanceof ApiDocsSchemaError).toBe(false);
  });

  it('falls back to prototype checks for a subclass without its own brand', () => {
    class MyErr extends ApiDocsSchemaError {}
    const err = new MyErr('acme');

    expect(err instanceof ApiDocsSchemaError).toBe(true);
    expect(err instanceof MyErr).toBe(true);
    const plainInstance: unknown = new ApiDocsSchemaError('acme');
    const brandedObject: unknown = { [BRAND]: ['express-api-contract.v1.ApiDocsSchemaError'] };
    expect(plainInstance instanceof MyErr).toBe(false);
    expect(brandedObject instanceof MyErr).toBe(false);
  });

  it('supports a subclass that declares its own brand', () => {
    class Branded extends ApiDocsSchemaError {
      static readonly [BRAND_KEY] = 'x.Branded';
    }
    const instance = new Branded('acme');
    const brands = (instance as unknown as Record<PropertyKey, unknown>)[BRAND] as string[];

    expect(brands).toContain('express-api-contract.v1.ApiDocsSchemaError');
    expect(brands).toContain('x.Branded');
    expect(instance instanceof ApiDocsSchemaError).toBe(true);
    expect(instance instanceof Branded).toBe(true);
  });

  it('does not depend on this.name (renamed class still brand-checks correctly)', () => {
    const err = new ApiDocsSchemaError('acme');
    const Renamed = ApiDocsSchemaError;
    Object.defineProperty(Renamed, 'name', { value: 'TotallyDifferentName' });

    expect(err instanceof Renamed).toBe(true);
    expect(err.name).toBe('ApiDocsSchemaError');
  });
});
