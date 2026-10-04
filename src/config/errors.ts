// ST-002 (S-02) owns config/errors.ts. ADR-49 (supersedes ADR-42's `this.name`
// brand comparison): the brand is a stable string code per class, carried on
// the instance as the set of codes along its class chain, never `this.name`.
import { BRAND, BRAND_KEY } from '../core/types.js';

/** Walks the constructor chain of `ctor`, collecting each own `[BRAND_KEY]`. */
function collectBrands(ctor: unknown): string[] {
  const brands: string[] = [];
  let current = ctor;
  while (typeof current === 'function') {
    if (Object.prototype.hasOwnProperty.call(current, BRAND_KEY)) {
      const brand = (current as unknown as Record<symbol, string>)[BRAND_KEY];
      if (brand !== undefined) {
        brands.push(brand);
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return brands;
}

export class ApiDocsConfigError extends Error {
  static readonly [BRAND_KEY]: string = 'express-api-contract.v1.ApiDocsConfigError';

  override readonly name = 'ApiDocsConfigError';
  readonly code = 'API_DOCS_CONFIG_ERROR';
  readonly path: string;
  readonly expected: string;
  readonly [BRAND]: string[];

  constructor(path: string, expected: string) {
    super(`Invalid option "${path}": expected ${expected}`);
    this.path = path;
    this.expected = expected;
    this[BRAND] = collectBrands(new.target);
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    const ownKey = Object.prototype.hasOwnProperty.call(this, BRAND_KEY)
      ? (this as unknown as Record<symbol, string>)[BRAND_KEY]
      : undefined;
    if (ownKey === undefined) {
      // No own brand declared on this (sub)class: fall back to a normal
      // prototype-chain instanceof check (ADR-49).
      return Function.prototype[Symbol.hasInstance].call(this, instance);
    }
    const brands = (instance as { [BRAND]?: unknown } | null | undefined)?.[BRAND];
    return Array.isArray(brands) && brands.includes(ownKey);
  }
}
