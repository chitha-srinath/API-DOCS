import { BRAND, BRAND_KEY } from '../core/types.js';

export const EAD_ASYNC_SCHEMA = 'EAD_ASYNC_SCHEMA' as const;
export const EAD_SCHEMA_NO_JSONSCHEMA = 'EAD_SCHEMA_NO_JSONSCHEMA' as const;

function collectBrands(ctor: unknown): string[] {
  const codes: string[] = [];
  let current = ctor;
  while (typeof current === 'function') {
    if (Object.prototype.hasOwnProperty.call(current, BRAND_KEY)) {
      codes.push((current as unknown as Record<PropertyKey, unknown>)[BRAND_KEY] as string);
    }
    current = Object.getPrototypeOf(current);
  }
  return codes;
}

// ADR-31(1) + ADR-49: branded error thrown when a schema's `validate` returns a
// Promise (async schemas are not supported by the sync SchemaAdapter contract).
export class ApiDocsSchemaError extends Error {
  static readonly [BRAND_KEY]: string = 'express-api-docs.v1.ApiDocsSchemaError';

  readonly code: typeof EAD_ASYNC_SCHEMA = EAD_ASYNC_SCHEMA;
  readonly vendor: string;
  readonly route?: string;
  readonly [BRAND]: string[];

  constructor(vendor: string, route?: string) {
    super(`Async schema validation is not supported (vendor: ${vendor}${route ? `, route: ${route}` : ''})`);
    this.name = 'ApiDocsSchemaError';
    this.vendor = vendor;
    this.route = route;
    this[BRAND] = collectBrands(new.target);
  }

  static [Symbol.hasInstance](x: unknown): boolean {
    const hasOwn = Object.prototype.hasOwnProperty.call(this, BRAND_KEY);
    const key = hasOwn ? ((this as unknown as Record<PropertyKey, unknown>)[BRAND_KEY] as string) : undefined;
    if (key !== undefined) {
      const brands = (x as Record<PropertyKey, unknown> | null | undefined)?.[BRAND];
      return Array.isArray(brands) && brands.includes(key);
    }
    return Function.prototype[Symbol.hasInstance].call(this, x);
  }
}
