import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

async function lint(code: string, filePath: string) {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

describe('eslint rules (ADR-20, ADR-21, ADR-04, ADR-39)', () => {
  it('bans local Symbol() in src/**', async () => {
    const messages = await lint("const s = Symbol('x');\nexport { s };\n", 'src/foo.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('allows Symbol.for(...) in src/**', async () => {
    const messages = await lint("const s = Symbol.for('x');\nexport { s };\n", 'src/foo.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(false);
  });

  it('bans zod import outside the adapter', async () => {
    const messages = await lint("import { z } from 'zod';\nexport { z };\n", 'src/spec/x.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('allows zod import in src/adapter/zod.ts', async () => {
    const messages = await lint("import { z } from 'zod';\nexport { z };\n", 'src/adapter/zod.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  });

  it('bans zod and adapter imports in src/config/**', async () => {
    const zodMsgs = await lint("import { z } from 'zod';\nexport { z };\n", 'src/config/x.ts');
    expect(zodMsgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);

    const adapterMsgs = await lint(
      "import { zodAdapter } from '../adapter/zod';\nexport { zodAdapter };\n",
      'src/config/x.ts',
    );
    expect(adapterMsgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);

    const typeMsgs = await lint(
      "import type { SchemaAdapter } from '../adapter/types';\nexport type { SchemaAdapter };\n",
      'src/config/x.ts',
    );
    expect(typeMsgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);

    const controlMsgs = await lint("import { x } from '../core/types';\nexport { x };\n", 'src/config/x.ts');
    expect(controlMsgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  });

  it('bans require("express4") outside test/fixtures/**', async () => {
    const messages = await lint("const e = require('express4');\nmodule.exports = e;\n", 'test/route/x.test.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('allows require("express4") in test/fixtures/**', async () => {
    const messages = await lint("const e = require('express4');\nmodule.exports = e;\n", 'test/fixtures/majors.ts');
    expect(messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(false);
  });
});
