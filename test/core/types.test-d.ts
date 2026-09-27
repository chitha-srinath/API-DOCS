import { expectTypeOf, test } from 'vitest';
import type { HttpMethod, DetectedOperation, Logger, RegistryEntry, RouteRegistry } from '../../src/core/types.js';
import { META, MOUNT, CHILD, RECORDER, BRAND, BRAND_KEY } from '../../src/core/types.js';

test('core/types type shape', () => {
  expectTypeOf<'get'>().toMatchTypeOf<HttpMethod>();
  // @ts-expect-error - 'fetch' is not a valid HttpMethod
  const _bad: HttpMethod = 'fetch';

  expectTypeOf<DetectedOperation['source']>().toEqualTypeOf<'typed' | 'describe' | 'plain'>();

  expectTypeOf(META).toEqualTypeOf<typeof META>();

  expectTypeOf<Logger['debug']>().toBeFunction();
  expectTypeOf<Logger['warn']>().toBeFunction();

  expectTypeOf<RegistryEntry['source']>().toEqualTypeOf<'typed' | 'describe'>();
  expectTypeOf<RouteRegistry['entries']>().returns.toEqualTypeOf<readonly RegistryEntry[]>();
  expectTypeOf<Parameters<RouteRegistry['register']>[0]>().toEqualTypeOf<Omit<RegistryEntry, 'id'>>();

  // unique-symbol checks (vitest's expectTypeOf lacks a dedicated matcher, so
  // assert assignability both ways against `unique symbol`-typed placeholders).
  type AssertUniqueSymbol<T extends symbol> = T;
  type _M = AssertUniqueSymbol<typeof META>;
  type _Mo = AssertUniqueSymbol<typeof MOUNT>;
  type _C = AssertUniqueSymbol<typeof CHILD>;
  type _R = AssertUniqueSymbol<typeof RECORDER>;
  type _B = AssertUniqueSymbol<typeof BRAND>;
  type _BK = AssertUniqueSymbol<typeof BRAND_KEY>;
});
