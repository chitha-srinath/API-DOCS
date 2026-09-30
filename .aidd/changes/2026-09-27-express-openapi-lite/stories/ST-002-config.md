---
id: ST-002
title: "Config: the OPTION_SPEC table (including schemaAdapter), defaults, validation, merge, and the branded errors"
wave: 2
status: built
attempts: 0
ac_ids:
  - "AC-005"
  - "AC-036"
  - "AC-038"
  - "AC-039"
  - "AC-040"
  - "AC-041"
  - "AC-042"
  - "AC-044"
  - "AC-045"
  - "AC-046"
  - "AC-047"
depends_on:
  - "ST-001"
file_scope:
  owns:
    - "src/config/**"
    - "test/config/**"
  creates:
    - "src/config/"
    - "test/config/"
---

# ST-002 — Config: the OPTION_SPEC table (including schemaAdapter), defaults, validation, merge, and the branded errors

> Epic row id: **S-02** (S-0N maps to ST-00N). Wave 2, parallel with ST-003. Depends on S-01.
> Risk: **medium** (R-4: hand-written validators; the `satisfies` type lock).
> AC scope in this story: AC-005 and AC-047 = **the `schemaAdapter` option row only**;
> AC-044 = cases **(a, b)** only ((c, d) belong to ST-004). AC-043 maps to S-07, but the
> A-9 cross-field rule it relies on is part of C1 and is implemented here.

## Context

The repo is greenfield (`.aidd/context/snapshot.md`; no re-crawl). ST-001 (Wave 1) supplies
`package.json`, tsconfig, vitest, eslint, stryker and `src/core/types.ts` (including the `BRAND`
instance key `Symbol.for('express-api-docs.v1.brand')` and the `BRAND_KEY` class key
`Symbol.for('express-api-docs.v1.brandKey')`, per ADR-49, which supersedes ADR-43/ADR-42's brand
comparison). Do **not** edit any of those
(epic: "Other stories that need changes to these files send requests through their story report.
They do not edit the files."). ST-003 runs in parallel and owns `src/adapter/**`, `test/adapter/**`
and `test/fixtures/stub-adapter.ts`; do not touch them. Wave-2 disjointness (epic): "Wave 2 compares
S-02 {`src/config/**`, `test/config/**`} with S-03 {`src/adapter/**`, `test/adapter/**`,
`test/fixtures/stub-adapter.ts`}. The intersection is empty."

**Ownership (epic matrix, verbatim):** "`src/config/**` (including the `schemaAdapter` row and the
branded `ApiDocsConfigError` in `errors.ts`), `test/config/**`". Six src files (C1):
`src/config/spec-table.ts`, `defaults.ts`, `validate.ts`, `merge.ts`, `errors.ts`, `types.ts`.

**Component C1 (architecture.md, verbatim):**

> `ApiDocsOptions` is a hand-written TS type in which every key is optional. `OPTION_SPEC` is a table of rows `{ path, default, check, allowed, description }`, keyed by dotted path, and is the single runtime source. It is compile-time locked to the type through `satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>`. `DEFAULT_OPTIONS` is built from the table and deep-frozen. `validateOptions()` rejects unknown keys, rejects invalid values, and enforces the A-9 cross-field rule, throwing `ApiDocsConfigError(path, expected)`. `mergeOptions(defaults, global, route)`: plain objects recurse; arrays, functions and primitives replace.

**ADR-04** (key sentence): "the `satisfies` lock fails `tsc` if a key is added to the type but not
the table, or the reverse." **ADR-21** import boundary: "The core (`.` entry) **never imports `zod`**."
The ESLint rule is owned by S-01; `src/config/**` must import neither `zod` nor `src/adapter/**`.

**ADR-38 (verbatim excerpt):**

> a global option `schemaAdapter` is added (an `OPTION_SPEC` row, default `null`, meaning "the core default `standardSchemaAdapter`"). The check is duck-typed: an object with function members `isSchema`, `validate` and `toJSONSchema`. A per-route override `meta.adapter` is also accepted. Resolution order is `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`. The last is injected by the S-07 composition root, so `src/config/**` still never imports `src/adapter/**` (ADR-04). `DEFAULT_OPTIONS.schemaAdapter === null` keeps AC-036 deep-equality.

So: type the `schemaAdapter` option structurally in `src/config/types.ts` (or via a type-only import
of the port from `src/core/types.ts` if S-01 defines it there) — never a value/type import from
`src/adapter/**`. `meta.adapter` resolution belongs to S-04; injection of `standardSchemaAdapter` to S-07.

**ADR-42 — brand comparison SUPERSEDED by ADR-49.** Only its "stable `name`
(`'ApiDocsConfigError'`) and `code` properties are kept" survives.

**ADR-49 (verbatim excerpt, owner S-02 for `config/errors.ts`):**

> **Brand:** the brand is a **stable string code per class**, never `this.name`. `core/types.ts` exports `BRAND = Symbol.for('express-api-docs.v1.brand')` (the instance key) and `BRAND_KEY = Symbol.for('express-api-docs.v1.brandKey')` (the class key). Each class declares `static readonly [BRAND_KEY] = 'express-api-docs.v1.ApiDocsConfigError'` (respectively `…ApiDocsSchemaError`).
> **Construction:** the constructor stores the **set of codes along its class chain**: `this[BRAND] = collectBrands(new.target)`, which walks `Object.getPrototypeOf` over constructors and gathers each own `[BRAND_KEY]`.
> **`instanceof`:** `static [Symbol.hasInstance](x) { const k = Object.prototype.hasOwnProperty.call(this, BRAND_KEY) ? this[BRAND_KEY] : undefined; return k !== undefined && Array.isArray(x?.[BRAND]) && x[BRAND].includes(k); }`. When a user subclass declares no brand, it falls back to `Function.prototype[Symbol.hasInstance].call(this, x)` (a normal prototype check).
> **Unchanged:** `name` and `code` properties stay for messages and for README guidance.
> **Tests:** S-02 and S-03 unit tests cover a subclass, a renamed class and a foreign object with a wrong brand (false).

This story owns `src/config/errors.ts` (`ApiDocsConfigError`, including `collectBrands` or a local
equivalent; import `BRAND`/`BRAND_KEY` from `src/core/types.ts`). The cross-copy/minified
`instanceof` assertions are S-07's (`test/entries/dual-load.test.ts`, `test/entries/minified.test.ts`);
do not write them here.

**ADR-05 / ADR-27(d):** "The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, … `thresholds.break` stays at 70." **R-4:** "Mitigations are one test per AC-045 example and Stryker on `config/**`."

**ADR-29, test-strategy #7 (verbatim):** "every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient."

**Downstream consumers:** ST-004 (per-route merge, `validateRequests`, `onValidationError`,
`validateResponses`, reads `schemaAdapter` for `meta.adapter ?? options.schemaAdapter ?? …`),
ST-006 (`openapi.info/servers/tags`, `securitySchemes`, `security`, `autoDetect.include/exclude`,
`detectedDefaultResponse`, `operationIdStrategy`, `tagStrategy`), ST-007 (public export of
`DEFAULT_OPTIONS`, `ApiDocsConfigError`; path/UI/toggle options; `schemaAdapter` wiring; AC-036
resolved-config equality, AC-043, AC-045 "before mount"), ST-008 (README defaults table incl.
`schemaAdapter`). Export from `src/config/*`: `ApiDocsOptions`, `OPTION_SPEC`, `OptionRow`,
`OptionPath`, `DEFAULT_OPTIONS`, `validateOptions`, `mergeOptions`, `ApiDocsConfigError`.
ST-007 owns the barrels (`src/index.ts`, `src/manual.ts`, `src/zod.ts`); do not edit them.

**Options that must have rows (names provisional per A-6, behavior binding):**
`specPath` (default `/openapi.json`, must start with `/`), `docsPath` (default `/docs`, must start
with `/`), `ui` (`'scalar'` default | `'swagger-ui'`), `cdnUrl`, `serveSpec` (default true),
`serveDocs` (default true), `docs.specUrl`, `openapi.info` (title, version, description),
`openapi.servers`, `openapi.tags`, `securitySchemes`, `security`, `validateRequests` (default true,
A-7), `validateResponses` (unset/false | `'warn'` | `'error'`), `onValidationError`, `autoDetect`
(default on, A-1; `false` or `{ include, exclude }`), `detectedDefaultResponse`,
`operationIdStrategy`, `tagStrategy`, **`schemaAdapter` (default `null`; duck-typed, ADR-38)**.

**Assumptions (prd.md):** A-8 "config errors throw `ApiDocsConfigError` synchronously." A-9
"`serveSpec: false` with `serveDocs: true` throws `ApiDocsConfigError` at setup unless `docs.specUrl` is set explicitly."

## Acceptance criteria (from PRD)

- **AC-005:** Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code. *(This story: the `schemaAdapter` option row only.)*
- **AC-036:** Given the package exports, When `DEFAULT_OPTIONS` is imported, Then it is a deep-frozen object whose values deep-equal the resolved config of `createApiDocs()` with no options. It contains a default for every option listed in AC-037 to AC-042. *(This story: deep-frozen, a row per option, `schemaAdapter: null`; resolved-config equality is ST-007.)*
- **AC-038:** Given overrides of `openapi.info` (title, version, description), `openapi.servers` and `openapi.tags`, When the spec is generated, Then the spec's `info`, `servers` and `tags` equal the overridden values. *(This story: accepted, validated, merged.)*
- **AC-039:** Given `securitySchemes` with a bearer scheme and a global `security: [{ bearer: [] }]`, When the spec is generated, Then every operation that has no route-level `security` inherits the global requirement, and a route declaring `security: []` has an empty `security` array in its operation. *(This story: options + merge where route `[]` replaces global.)*
- **AC-040:** Given `validateRequests: false` globally, When an invalid request is sent to a typed route, Then the handler is called and no 400 is returned. Given a global `onValidationError` formatter with validation on, When validation fails, Then the formatter's status and body are returned. (`validateResponses` modes are covered by AC-012 to AC-014.) *(This story: options accepted and validated.)*
- **AC-041:** Given `autoDetect` with `include: ['/api/**']` and a custom `detectedDefaultResponse` (e.g. status `204`, description `No Content`), When the spec is generated, Then only plain routes under `/api/` are auto-detected, and each detected operation's responses equal the custom default. *(This story: options accepted and validated.)*
- **AC-042:** Given custom `operationIdStrategy` and `tagStrategy` functions, When the spec is generated, Then every operation without an explicit `operationId` or tags (both typed and auto-detected) uses the functions' return values. With neither option set, the defaults in A-3 and A-4 apply (e.g. `GET /users/:id` produces `getUsersById` with tag `users`). *(This story: options accepted; functions replace.)*
- **AC-044 (a, b):** Given defaults, global options and per-route options that overlap, When the effective options for a route are resolved, Then the precedence is per-route over global over defaults, as a deep merge in which arrays are replaced, not concatenated. Tests cover: (a) a global `openapi.info.title` override keeps the default `info.version`; (b) global `tags: ['a','b']` with per-route `tags: ['c']` yields `['c']`.
- **AC-045:** Given `createApiDocs()` called with an unknown key (e.g. `specPth`) or an invalid value (e.g. `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), When setup runs, Then it throws synchronously, before mounting any route, an exported `ApiDocsConfigError` whose message contains the offending option path and the allowed values or type. *(This story: `validateOptions()` throws; "before mounting" is ST-007.)*
- **AC-046:** Given a TypeScript consumer, When it passes an unknown key or a wrongly typed value to `createApiDocs()` or to per-route options, Then `tsc --noEmit` reports an error (verified by type tests with `@ts-expect-error`), and all options are optional in the exported `ApiDocsOptions` type.
- **AC-047:** Given `schemaAdapter: stubAdapter` globally or per-route, When requests are validated and the spec is generated, Then the stub adapter's parse and toJsonSchema are used, and per-route overrides global. *(This story: the option row, validation and merge only; runtime use is S-04/S-06/S-07.)*

## Test plan

Write these FIRST; capture the failing run (red) in the Builder Report before any `src/config` code.
Epic S-02 obligations: the existing `validate`, `merge`, `defaults`, `options.test-d`, plus
`schemaAdapter` checks in `validate`/`defaults`, plus the new `errors.test.ts`.

1. `test/config/validate.test.ts`
   - `rejects unknown key specPth` → `ApiDocsConfigError`; message contains `specPth`.
   - `rejects ui 'redoc'` → message contains `ui`, `scalar`, `swagger-ui`.
   - `rejects validateResponses 'maybe'` → message contains `validateResponses`, `warn`, `error`.
   - `rejects specPath 'no-slash'` → message contains `specPath` and "starts with `/`".
   - `rejects nested unknown key` (`openapi.infoo`) → message contains the dotted path.
   - `A-9: serveSpec false + serveDocs true without docs.specUrl throws` → names `serveSpec` and `docs.specUrl`; `with docs.specUrl does not throw`; `serveSpec false + serveDocs false does not throw`.
   - `schemaAdapter: accepts null`; `accepts a duck-typed object with function members isSchema, validate, toJSONSchema` (inline plain object; no import from `src/adapter/**`).
   - `schemaAdapter: rejects a string / {} / object missing toJSONSchema / object whose validate is not a function` → message contains `schemaAdapter` and names `isSchema`, `validate`, `toJSONSchema`.
   - `accepts empty options`; `accepts a full valid options object` (AC-038..042 values incl. functions and a duck-typed `schemaAdapter`).
   - `throws synchronously` (not a rejected promise); error exposes `path` and `expected`.
2. `test/config/merge.test.ts`
   - `AC-044a: global openapi.info.title keeps default info.version`.
   - `AC-044b: global tags ['a','b'] + route tags ['c'] → ['c']`.
   - `route security [] replaces global security` (AC-039).
   - `functions replace` (`operationIdStrategy`), `schemaAdapter object replaces (not deep-merged)`, `primitives replace`, `inputs are not mutated`, `undefined does not override`.
3. `test/config/defaults.test.ts`
   - `DEFAULT_OPTIONS is deep-frozen` (recursive `Object.isFrozen`).
   - `has a row for every option` (explicit list of paths incl. `schemaAdapter` present in `OPTION_SPEC`).
   - `defaults: specPath '/openapi.json', docsPath '/docs', ui 'scalar', validateRequests true, validateResponses off, autoDetect on, serveSpec/serveDocs true`.
   - `DEFAULT_OPTIONS.schemaAdapter === null` (ADR-38, AC-047).
   - `DEFAULT_OPTIONS passes validateOptions()`.
4. `test/config/errors.test.ts` (ADR-49; supersedes the ADR-42 `this.name` brand)
   - `class brand code`: `ApiDocsConfigError[BRAND_KEY] === 'express-api-docs.v1.ApiDocsConfigError'` (own static property; `BRAND_KEY` from `src/core/types.ts`, equal to `Symbol.for('express-api-docs.v1.brandKey')`).
   - `instance carries class-chain brand set`: `Array.isArray(err[BRAND])` and `err[BRAND]` includes `'express-api-docs.v1.ApiDocsConfigError'` (`BRAND` = `Symbol.for('express-api-docs.v1.brand')`); it never contains `err.name`.
   - `Symbol.hasInstance` (brand path): a plain object `{ [BRAND]: ['express-api-docs.v1.ApiDocsConfigError'] }` is `instanceof ApiDocsConfigError`; a foreign object with a wrong brand (`{ [BRAND]: ['express-api-docs.v1.ApiDocsSchemaError'] }`), a non-array brand (`{ [BRAND]: 'express-api-docs.v1.ApiDocsConfigError' }`), `null`, `undefined` and `new Error()` are not.
   - `subclass with its own brand`: `class Sub extends ApiDocsConfigError { static readonly [BRAND_KEY] = 'test.Sub' }` → `new Sub(...)[BRAND]` contains both `'test.Sub'` and `'express-api-docs.v1.ApiDocsConfigError'`; the instance is `instanceof Sub` and `instanceof ApiDocsConfigError`.
   - `subclass without a brand (prototype fallback)`: `class Plain extends ApiDocsConfigError {}` → `new Plain(...)` is `instanceof Plain` and `instanceof ApiDocsConfigError`; a bare `new ApiDocsConfigError(...)` and a branded plain object are **not** `instanceof Plain` (fallback is `Function.prototype[Symbol.hasInstance]`).
   - `renamed class`: a class obtained via `const Renamed = ApiDocsConfigError` / a subclass whose `name` is redefined via `Object.defineProperty(C, 'name', { value: 'x' })` still passes `instanceof ApiDocsConfigError` (no dependence on function names).
   - `name === 'ApiDocsConfigError'`; stable `code` property present and a string; `instanceof Error` for a real instance; `path` and `expected` exposed.
5. `test/config/options.test-d.ts` (via `vitest --typecheck`)
   - `@ts-expect-error` on `specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`, `validateRequests: 'yes'`, `schemaAdapter: 'zod'`.
   - `const o: ApiDocsOptions = {}` compiles; `schemaAdapter: null` compiles; per-route options type rejects unknown keys.
   - each top-level key is optional.

Import boundary (no `zod`, no `src/adapter/**` in `src/config/**`) is enforced by S-01's ADR-21 ESLint rule via `npm run lint`.

## Verification commands

Copied verbatim from architecture.md:

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`) **[runner SUPERSEDED by ADR-35 → Stryker command runner with `vitest.stryker.config.ts`; `@stryker-mutator/vitest-runner` removed]**, probe after scaffold story (the CLI was probed below)
- mutation, scoped per story at merge (ADR-50(a); break threshold 70 applies to this scope): `npx stryker run --mutate "src/config/**" --incremental`

**Merge rule (ADR-29, test-strategy #7):** run the **full** `npm test` (including global coverage
thresholds) in this story's worktree before merge; a focused `test/config` run is not sufficient.
Also run the ADR-50 scoped mutation command above and record its mutation score (must be >= 70).
Record the command, exit code and summary in the Builder Report.

## Builder Report

### Files created (ownership set only)

`src/config/types.ts`, `spec-table.ts`, `defaults.ts`, `validate.ts`, `merge.ts`, `errors.ts`;
`test/config/validate.test.ts`, `merge.test.ts`, `defaults.test.ts`, `errors.test.ts`,
`options.test-d.ts`. No file outside `src/config/**` / `test/config/**` was read for edit
or written.

### Design notes (for downstream stories)

- `ApiDocsOptions`, `OptionRow`, `OptionPath<T>`, `RouteOptions` (`Partial<ApiDocsOptions>`),
  `SchemaAdapter` (duck-typed port) all live in `src/config/types.ts`.
- `OptionPath<T>` treats `docs` and `openapi` as "groups" (expanded one level into
  `docs.specUrl`, `openapi.info`, `openapi.servers`, `openapi.tags`) via a **hand-maintained**
  `GroupKeyNames = 'docs' | 'openapi'` union, not a structural marker. A structural
  marker (an optional `never`-typed brand property) was tried first but broke: an
  index-signature type like `Record<string, unknown>` (`securitySchemes`) is
  structurally assignable to `{ readonly __group?: never }` in TS's `extends` check,
  so it was silently mis-classified as a group. The explicit key-name list avoids that
  trap while still satisfying ADR-04: `OPTION_SPEC` is locked to `OptionPath<ApiDocsOptions>`
  via `satisfies`, so adding/removing a top-level key, or a key under `docs`/`openapi`,
  without a matching table row fails `tsc` either way.
- `mergeOptions<T>(defaults, global, route)` is a small generic (not `ApiDocsOptions`-specific)
  deep merge: plain data objects (no function-valued own properties, `Object.prototype`
  prototype) recurse; arrays, functions, primitives, and any object that itself carries
  function members (e.g. a duck-typed `schemaAdapter`) replace wholly. That last rule is
  deliberate: it is how "schemaAdapter replaces, not deep-merges" (test plan item 2) is
  satisfied — a partial override object never inherits sibling fields (e.g. `validate`,
  `toJSONSchema`) from a shallower layer. `global`/`route` are typed `DeepPartial<T>`
  (exported from `merge.ts`) so callers need not repeat every sibling key of a nested group.
- `validateOptions()` walks top-level keys; for `docs`/`openapi` it walks one level of
  sub-keys against dotted `OPTION_SPEC` rows; every other key is checked directly. Unknown
  keys and failed `row.check()` both throw `ApiDocsConfigError(path, allowed ?? description)`
  synchronously. The A-9 cross-field rule is checked last, after per-key validation.
- `ApiDocsConfigError` (ADR-49): brand is the **string code** `express-api-docs.v1.ApiDocsConfigError`
  on `static readonly [BRAND_KEY]` (typed `: string`, not left as a literal type, so a
  subclass may declare its own differently-valued `[BRAND_KEY]` without a `tsc` variance
  error). The constructor sets `this[BRAND] = collectBrands(new.target)` (walks the
  constructor chain via `Object.getPrototypeOf`, collecting each own `[BRAND_KEY]`).
  `static [Symbol.hasInstance]` checks the brand array when `this` (the class being tested
  against) declares an own `BRAND_KEY`, else falls back to `Function.prototype[Symbol.hasInstance]`.
  `this.name` is never part of the brand (ADR-49 supersedes ADR-42).
- Import boundary: `src/config/**` imports only from `./` (within config) and
  `../core/types.js` (`BRAND`/`BRAND_KEY`). No `zod`, no `src/adapter/**` — enforced by
  ESLint (`no-restricted-imports`, already scoped to `src/config/**` in `eslint.config.js`
  from ST-001) and confirmed by `npm run lint` below.

### Red (failing) run — before any `src/config` implementation existed

`src/config/**` was temporarily hidden (`git stash push -u -- src/config`, restored
immediately after via `git stash pop`) with all five `test/config/**` files already
written, then run:

```
$ npx vitest run test/config --coverage=false
...
⎯⎯⎯ Unhandled Source Error ⎯⎯⎯
TypeCheckError: Cannot find module '../../src/config/merge.js' or its corresponding type declarations.
 ❯ test/config/merge.test.ts:2:30
⎯⎯⎯ Unhandled Source Error ⎯⎯⎯
TypeCheckError: Cannot find module '../../src/config/errors.js' or its corresponding type declarations.
 ❯ test/config/validate.test.ts:2:36
⎯⎯⎯ Unhandled Source Error ⎯⎯⎯
TypeCheckError: Cannot find module '../../src/config/validate.js' or its corresponding type declarations.
 ❯ test/config/validate.test.ts:3:33
(+ 10 more errors from the not-yet-existing modules / an unrelated `override` typo since fixed)

 Test Files  5 failed (5)
      Tests  1 failed (1)
Type Errors  no errors
     Errors  13 errors
```

Command restoring the implementation immediately after capturing the red run:
`git stash pop` → exit 0, `ls src/config` confirmed all six files present again.

### Green run

```
$ npx vitest run test/config --coverage=false
 Test Files  5 passed (5)
      Tests  36 passed (36)
Type Errors  no errors
```

(One intermediate fixup round: an `OptionPath` structural-marker design produced a
`securitySchemes` key-mismatch `tsc` error under `satisfies`, and `mergeOptions`'s generic
constraint/`DeepPartial` needed several iterations before `vitest --typecheck` was clean —
all internal red→green cycles on the way to the run above, not the initial red evidence.)

### Full `npm test` (ADR-29, test-strategy #7 — the whole suite, not a focused path)

```
$ npm test
> vitest run --coverage --typecheck
 Test Files  24 passed (24)
      Tests  138 passed (138)
Type Errors  no errors

Coverage summary:
All files          |   97.01 |    92.26 |     100 |   97.38
 src/config        |   96.46 |    94.26 |     100 |   96.26
  errors.ts        |     100 |       90 |     100 |     100
  merge.ts         |   94.73 |     92.3 |     100 |   94.44
  validate.ts      |      88 |    80.76 |     100 |      88
```

All global thresholds (90/90/90/90) met; `src/config/**` itself is above every threshold.

### Lint / typecheck

```
$ npm run lint
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```
(exit 0; one intermediate Prettier-formatting fixup on `spec-table.ts`/`types.ts` via
`npx prettier --write`, ESLint itself was clean on the first pass — including the
`src/config/**` `no-restricted-imports` rule for `zod`/`src/adapter/**`.)

```
$ npx tsc --noEmit
(no output — exit 0)
```

### Scoped mutation run (ADR-50(a); break threshold 70)

```
$ npx stryker run --mutate "src/config/**" --incremental
...
All files      |  75.94 |   75.94 |      401 |         3 |        128 |        0 |        0 |
 defaults.ts   |  78.05 |   78.05 |       30 |         2 |          9 |        0 |        0 |
 errors.ts     |  85.19 |   85.19 |       22 |         1 |          4 |        0 |        0 |
 merge.ts      |  84.21 |   84.21 |       32 |         0 |          6 |        0 |        0 |
 spec-table.ts |  71.39 |   71.39 |      252 |         0 |        101 |        0 |        0 |
 validate.ts   |  89.04 |   89.04 |       65 |         0 |          8 |        0 |        0 |
INFO MutationTestReportHelper Final mutation score of 75.94 is greater than or equal to break threshold 70
Done in 33 minutes and 46 seconds. [exit 0]
```

Score 75.94 >= 70 (ADR-05/ADR-27(d)/R-4 satisfied). Most survivors are in `spec-table.ts`'s
`allowed`/`description` string literals (never asserted against in tests, by design — only
`path` and message substrings are asserted) and in redundant boolean-algebra rewrites of
already-covered `check` predicates; none change externally observable validate/merge/defaults
behavior for any AC in scope.

### Self-check against every AC in scope

- **AC-005** (schemaAdapter option row only): `test/config/validate.test.ts` accepts a
  duck-typed stub (no import from `src/adapter/**`); row exists in `OPTION_SPEC`. PASS.
- **AC-036** (deep-frozen, `schemaAdapter: null`; a row per option — resolved-config
  equality is ST-007): `test/config/defaults.test.ts` — `isRecursivelyFrozen`,
  `OPTION_SPEC` key list, `DEFAULT_OPTIONS.schemaAdapter === null`. PASS.
- **AC-038** (openapi.info/servers/tags accepted, validated, merged): `validate.test.ts`
  "accepts a full valid options object"; `merge.test.ts` AC-044a covers nested merge of
  `openapi.info`. PASS.
- **AC-039** (route `security: []` replaces global `security`): `merge.test.ts`. PASS.
- **AC-040** (`validateRequests`/`onValidationError` options accepted+validated; runtime
  behavior is ST-004): rows exist, `validate.test.ts` full-object case covers both. PASS
  (in this story's scope).
- **AC-041** (`autoDetect`/`detectedDefaultResponse` accepted+validated): rows exist,
  covered by the full-object validate test. PASS (in scope).
- **AC-042** (`operationIdStrategy`/`tagStrategy` accepted; functions replace): rows exist;
  `merge.test.ts` "functions replace". PASS (in scope).
- **AC-044 (a, b)** (per-route > global > defaults; arrays replace): `merge.test.ts`
  AC-044a and AC-044b explicitly. PASS.
- **AC-045** (unknown key / invalid value throws synchronously, exported `ApiDocsConfigError`,
  message has path + allowed/type; "before mounting" is ST-007): `validate.test.ts` covers
  `specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`, nested
  `openapi.infoo`, and the synchronous-throw + `path`/`expected` exposure test. PASS
  (in this story's scope).
- **AC-046** (TS consumer: unknown/wrong-typed keys rejected by `tsc`, all options optional):
  `test/config/options.test-d.ts`, run under `vitest --typecheck` (part of `npm test`).
  `@ts-expect-error` on `specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`,
  `validateRequests: 'yes'`, `schemaAdapter: 'zod'`, and an unknown `RouteOptions` key. PASS.
- **AC-047** (option row + validation + merge only; runtime use is S-04/S-06/S-07):
  `validate.test.ts` schemaAdapter accept/reject cases; `merge.test.ts` "schemaAdapter
  object replaces (not deep-merged)"; `defaults.test.ts` `DEFAULT_OPTIONS.schemaAdapter
  === null`. PASS.

### git diff --stat (confined to ownership set)

```
$ git diff --stat --cached -- src/config test/config
 src/config/defaults.ts        |  37 +++++++++
 src/config/errors.ts          |  50 ++++++++++++
 src/config/merge.ts           |  49 ++++++++++++
 src/config/spec-table.ts      | 176 ++++++++++++++++++++++++++++++++++++++++++
 src/config/types.ts           | 116 ++++++++++++++++++++++++++++
 src/config/validate.ts        |  60 ++++++++++++++
 test/config/defaults.test.ts  |  71 +++++++++++++++++
 test/config/errors.test.ts    |  77 ++++++++++++++++++
 test/config/merge.test.ts     |  75 ++++++++++++++++++
 test/config/options.test-d.ts |  37 +++++++++
 test/config/validate.test.ts  | 161 ++++++++++++++++++++++++++++++++++++++
 11 files changed, 909 insertions(+)
```

All changes are new files under `src/config/**` and `test/config/**`; no file outside the
ownership set was touched.

### Status: **built**


## Auditor Report

**Round 1, final.** All 12 interrogated AC rows (AC-005, AC-036, AC-038, AC-039, AC-040,
AC-041, AC-042, AC-044a, AC-044b, AC-045, AC-046, AC-047) are **PROVEN**. No DISPUTED rows;
no challenge round issued. Evidence re-executed live by the auditor: `npm test` (24 files /
138 tests passed, coverage 97.01/92.26/100/97.38, all ≥ 90/90/90/90), `npm run lint` (exit 0),
`npx tsc --noEmit` (exit 0), and full-text reads of `test/config/validate.test.ts`,
`merge.test.ts`, `defaults.test.ts` confirming every cited assertion exists verbatim.
Story-level scope narrowings (spec-generation deferred to ST-006/ST-007, runtime validation
deferred to ST-004) match the story's own AC annotations, not builder-invented narrowing.
Full verdict: `audit/interrogation/ST-002-verdict.md`.

## Auditor Report (QA step 12 — final audit)

Interrogated AC-005, AC-036, AC-038, AC-039, AC-040, AC-041, AC-042, AC-044, AC-045,
AC-046, AC-047 (this story's share) against `ac-matrix.md`. Read `test/config/merge.test.ts`
and `test/config/validate.test.ts` source directly to confirm the `AC-044a`/`AC-044b`
labelled sub-cases assert what AC-044's Given/When/Then requires (route-level override
wins over global for both request- and response-validation config).

**Verdict: all 11 ACs — PROVEN.** No DISPUTED ACs for this story.
Full matrix: `audit/interrogation/qa-final-verdict.md`.

## Test Report (QA step 14 — g_test_report approved 2026-09-30)

Approved by human (let-me-look). Consolidated `qa/test-report.md`: 237+3 exhaustive cases,
all PASS, 0 open FAILs. Full suite 79/79 files, 644/649 tests (5 legit skips), coverage
98.56/93.35/99.45/99.34%. This story's claimed ACs are covered — see `ac-matrix.md` and
this story's `## Auditor Report` section above for per-AC verdicts.
