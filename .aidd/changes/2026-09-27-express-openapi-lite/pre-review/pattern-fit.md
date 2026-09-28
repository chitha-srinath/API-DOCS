# Pre-Implementation Review Findings — pattern-fit (RE-RUN #2, Supervisor V6)

<!-- Reviewer mode=pre, re-run against the amended plan: architecture.md ADR-32..ADR-48, prd.md (47 ACs incl. AC-047, zod ^4.2.0), epic.md, stories/ST-001..ST-008. Greenfield repo (no in-repo precedent), so the plan is judged against .aidd/constitution.md and ecosystem conventions for dual ESM/CJS TypeScript npm packages and Express middleware. -->

## Prior findings: status

| # | Prior severity | Status | Evidence |
|---|---|---|---|
| PF-1 | HIGH | RESOLVED (strengthened) | ADR-20, and now ADR-43 (architecture.md:108): the keys are protocol-versioned `express-api-docs.v1.*`. ST-001, ST-005, ST-007 dual-load. |
| PF-2 | HIGH | RESOLVED | ADR-21 plus ADR-47. ST-001, ST-003, ST-007 `no-zod-load`. |
| PF-3 | MEDIUM | RESOLVED | ADR-29; ST-001:131 (`@types/express` is an optional peer). ADR-36 now typechecks against v4 types in every express:4 cell. |
| PF-4 | MEDIUM | RESOLVED | ADR-24 plus ADR-40; ST-001. |
| PF-5 | MEDIUM | RESOLVED as a recorded deviation | ADR-28. G2 action is still pending. ADR-35 adds `vitest.stryker.config.ts` and a mutation job, which fall under the same deviation. |
| PF-6 | LOW | RESOLVED | ADR-29; ST-001. |
| PF-7 | LOW | RESOLVED | ADR-22, ADR-28, ADR-46 (the meta-test forbids Node 20). AC-027. |
| PF-8 | MEDIUM | RESOLVED (see new PF-13 for a residual) | ADR-47 (architecture.md:112): the peer is `^4.2.0`, the probe is cited, the `peer-floor` job installs `zod@4.2.0`, and `standard-floor.test.ts` is added. Covered by prd.md:22 (AC-004), ST-001:131,244, ST-003:161, ST-008:141. |
| PF-9 | MEDIUM | RESOLVED | ADR-40 (architecture.md:105): `splitting:false`, `shims:true`, the `keepAutoRecordExternal` plugin, and `build-shape.test.ts` asserts there is no `dist/chunk-*` and that the install call exists only in `auto-record`. ST-001. |
| PF-10 | LOW | RESOLVED | ADR-41 (architecture.md:106): `ApiDocsSchemaError` is added to `.` and `./manual`, re-exported from `./zod`, and the exact name set is asserted by `parity.test.ts`. C9 is marked superseded (architecture.md:45). ST-003, ST-007. |
| PF-11 | LOW | RESOLVED | ADR-48 (architecture.md:113): the `./package.json` export is added, plus manifest and pack tests. ST-001. |

No prior finding has regressed.

## New findings introduced by ADR-32 to ADR-48

| # | Severity | Artifact | Claim | Concrete risk scenario | Cited evidence |
|---|---|---|---|---|---|
| PF-12 | HIGH | ADR-42 brand check (ST-002 `config/errors.ts`, ST-003 `adapter/errors.ts`) | `static [Symbol.hasInstance](x) { return x[BRAND] === this.name }` compares the instance's brand, which is the **literal** `name` class field (`'ApiDocsSchemaError'`), against `this.name`. Inside a static method, `this.name` is the constructor's **Function.name**. Minifiers and bundlers rename that. | (a) A user bundles for production with esbuild `--minify` or terser (`keep_classnames` is false by default). `ApiDocsConfigError.name` becomes `e`, so `err instanceof ApiDocsConfigError` is **false even for the same copy**, and a user's `catch` falls through. (b) The user's bundle includes both `express-api-docs` and `express-api-docs/zod`. Under ADR-40 (`splitting:false`) each entry defines its own `class ApiDocsSchemaError`, so esbuild deconflicts one of them to `ApiDocsSchemaError2`. `instanceof` then fails across the two entries, which is exactly the case ADR-42 exists to fix. (c) A user's `class MyErr extends ApiDocsConfigError` inherits `hasInstance`, so `new MyErr() instanceof MyErr` is false. The planned tests (ST-002:146, ST-003:160, ST-007 dual-load) all run unminified `dist`, so none of them catch it. Fix: compare against a module constant (`const NAME = 'ApiDocsConfigError'`, `x[BRAND] === NAME`) and fall back to `Function.prototype[Symbol.hasInstance].call(this, x)` for subclasses. Add a test that bundles `dist/index.js` with esbuild `minify:true` and asserts `instanceof`. | ST-003:113 (field `name = 'ApiDocsSchemaError'`, static `=== this.name`); ST-001:88; ST-002:71,146; architecture.md:107 (ADR-42); architecture.md:105 (ADR-40, `splitting:false` duplicates code per entry) |
| PF-13 | MEDIUM | ADR-47 peer range vs the README guidance | The peer range `^4.2.0` excludes zod 4.0/4.1. The README (ST-008:69,122,141) tells zod <4.2 users to use `express-api-docs/zod`, which is a configuration the manifest itself declares unsupported. | A user on `zod@4.1.13` follows the README and installs the package. Because zod is present, npm (7+) checks the optional peer and fails with `ERESOLVE`, or needs `--legacy-peer-deps`; pnpm prints an unmet-peer warning. The documented path is either blocked or unsupported. No CI job tests `./zod` on zod 4.0/4.1, so the README promise is unverified. Fix, choose one: (1) keep `^4.0.0` as the peer range and make the `peer-floor` job run the `./zod` tests on `zod@4.0.0` plus a zero-config warn test; or (2) drop the "<4.2 use /zod" sentence and state that 4.2 is the minimum for every entry. | architecture.md:112 (ADR-47); ST-001:131; ST-008:69,141; prd.md:22 (AC-004) |
| PF-14 | LOW | ADR-39 lint guard | The rule only flags `require('express4')`. The tests are ESM TypeScript (vitest), where the natural form is `import express4 from 'express4'` or `await import('express4')`. Neither is a `require` CallExpression, and the ST-001 lint test only covers `require`. | A builder writes `import express4 from 'express4'` in `test/route/x.test.ts` and parameterizes locally. Lint passes, the dedupe and recorder path of ADR-39 is bypassed, and `installRecorder` runs on a copy that the dedupe would have dropped. Fix: also use `no-restricted-imports` (`paths: ['express4']`) plus an `ImportExpression[source.value='express4']` selector, and extend the ST-001:254 lint test. | architecture.md:104 (ADR-39); ST-001:115,254 |

<!-- Severity: CRITICAL blocks G2 until resolved; HIGH needs resolution or explicit waiver;
     MEDIUM/LOW advisory. -->

Conforming (no finding): the protocol-versioned `Symbol.for` keys (ADR-43, the same idea as a versioned global registry); `[META]` tags as the cross-copy bridge instead of a `globalThis` registry (ADR-44); duck-typed `schemaAdapter` with the resolution order route, then global, then default, and a `null` default (ADR-38); `next(err)` exactly once even after `headersSent` (ADR-33, which matches the Express docs); `splitting:false` plus an external side-effect entry (ADR-40); an esbuild pin deduped with tsup (ADR-45); the `./package.json` export (ADR-48); the Stryker command runner (ADR-35, recorded under ADR-28); the `freshExpress` require-cache isolation instead of `vi.resetModules` (ADR-34).

## Resolution log

| # | Resolution (revised artifact / waived by / rationale) |
|---|---|
| PF-1 | ADR-20, ADR-43; ST-001, ST-005, ST-007 |
| PF-2 | ADR-21, ADR-47; AC-004; ST-001, ST-003, ST-007 |
| PF-3 | ADR-29, ADR-36; ST-001 |
| PF-4 | ADR-24, ADR-29, ADR-40; ST-001, ST-005, ST-007 |
| PF-5 | ADR-28, ADR-35 (pending human action at G2) |
| PF-6 | ADR-29; ST-001 |
| PF-7 | ADR-22, ADR-28, ADR-46; AC-027; ST-001 |
| PF-8 | ADR-47; AC-004; ST-001, ST-003, ST-008 |
| PF-9 | ADR-40; ST-001 |
| PF-10 | ADR-41; ST-003, ST-007 |
| PF-11 | ADR-48; ST-001 |
| PF-12 | OPEN |
| PF-13 | OPEN |
| PF-14 | OPEN |
