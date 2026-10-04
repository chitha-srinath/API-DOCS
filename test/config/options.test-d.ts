import { expectTypeOf, test } from 'vitest';
import type { ApiDocsOptions, RouteOptions } from '../../src/config/types.js';

test('config/types: ApiDocsOptions type shape (AC-046)', () => {
  const empty: ApiDocsOptions = {};
  expectTypeOf(empty).toEqualTypeOf<ApiDocsOptions>();

  const withNullAdapter: ApiDocsOptions = { schemaAdapter: null };
  expectTypeOf(withNullAdapter).toEqualTypeOf<ApiDocsOptions>();

  // @ts-expect-error - specPth is not a known option key
  const badKey: ApiDocsOptions = { specPth: '/x' };
  void badKey;

  // @ts-expect-error - 'maybe' is not a valid validateResponses
  const badValidateResponses: ApiDocsOptions = { validateResponses: 'maybe' };
  void badValidateResponses;

  // @ts-expect-error - validateRequests must be a boolean
  const badValidateRequests: ApiDocsOptions = { validateRequests: 'yes' };
  void badValidateRequests;

  // @ts-expect-error - schemaAdapter must be a duck-typed object or null, not a string
  const badSchemaAdapter: ApiDocsOptions = { schemaAdapter: 'zod' };
  void badSchemaAdapter;

  // @ts-expect-error - RouteOptions rejects unknown keys too
  const badRoute: RouteOptions = { notAnOption: true };
  void badRoute;

  expectTypeOf<ApiDocsOptions>().toHaveProperty('specPath').toEqualTypeOf<string | undefined>();
});
