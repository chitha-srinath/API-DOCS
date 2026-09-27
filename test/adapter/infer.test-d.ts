import { expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import type { Infer } from '../../src/adapter/types.js';
import { obj, str } from '../fixtures/stub-adapter.js';

test('Infer<S> hook (AC-006)', () => {
  // Zod path (Zod v4 implements Standard Schema natively).
  const zodSchema = z.object({ id: z.string() });
  expectTypeOf<Infer<typeof zodSchema>>().toEqualTypeOf<{ id: string }>();

  // Stub path (via the fixture's phantom `__infer` marker).
  const stubSchema = obj({ id: str() }, ['id']);
  expectTypeOf<Infer<typeof stubSchema>>().toEqualTypeOf<{ id: string }>();

  // @ts-expect-error id must be a string, not a number
  const wrong: Infer<typeof zodSchema> = { id: 1 };
  void wrong;
});
