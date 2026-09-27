---
id: ST-002
title: "Config: the OPTION_SPEC table, defaults, validation, merge and errors"
wave: 2
status: ready
attempts: 0
ac_ids:
  - "AC-036"
  - "AC-038"
  - "AC-039"
  - "AC-040"
  - "AC-041"
  - "AC-042"
  - "AC-044"
  - "AC-045"
  - "AC-046"
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

# ST-002 — Config: the OPTION_SPEC table, defaults, validation, merge and errors

> Epic row id: **S-02** (the story schema requires `ST-NNN`, so S-02 maps to ST-002 and
> S-01 maps to ST-001). Wave 2, parallel with ST-003. Depends on S-01. Risk: **medium**
> (R-4 hand-written validators; the `satisfies` type lock). AC-044 covers cases (a) and (b)
> only; (c) and (d) belong to ST-004. AC-043 is not in this story's AC list (epic maps it to
> S-07), but the A-9 cross-field rule it relies on is part of C1 and is implemented here.

## Context

The repo is greenfield (`.aidd/context/snapshot.md`: no re-crawl). ST-001 (Wave 1) supplies
`package.json`, tsconfig, vitest, eslint, stryker and `src/core/types.ts`. Do **not** edit any
of those (epic: "Other stories that need changes to these files send requests through their
story report. They do not edit the files."). If you need a devDependency or script, record the
request in the Builder Report. ST-003 (adapter) runs in parallel in Wave 2 and owns
`src/adapter/**`; do not touch it. Wave-2 disjointness (epic): S-02 {`src/config/**`,
`test/config/**`} vs S-03 {`src/adapter/**`, `test/adapter/**`} — empty intersection.

**Owned files (6 src files, from C1):** `src/config/spec-table.ts`, `src/config/defaults.ts`,
`src/config/validate.ts`, `src/config/merge.ts`, `src/config/errors.ts`, `src/config/types.ts`,
plus everything under `test/config/**`.

**Component C1 (architecture.md, verbatim):**

> `ApiDocsOptions` is a hand-written TS type in which every key is optional. `OPTION_SPEC` is a table of rows `{ path, default, check, allowed, description }`, keyed by dotted path, and is the single runtime source. It is compile-time locked to the type through `satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>`. `DEFAULT_OPTIONS` is built from the table and deep-frozen. `validateOptions()` rejects unknown keys, rejects invalid values, and enforces the A-9 cross-field rule, throwing `ApiDocsConfigError(path, expected)`. `mergeOptions(defaults, global, route)`: plain objects recurse; arrays, functions and primitives replace.

**ADR-04 (key sentence) as amended by ADR-21.** ADR-04: "the `satisfies` lock fails `tsc` if a
key is added to the type but not the table, or the reverse." ADR-21 amends the import boundary:

> The core (`.` entry) **never imports `zod`**. An ESLint `no-restricted-imports` rule on `src/**` except `src/adapter/zod.ts` enforces this

That rule is owned by S-01 (`eslint.config.js`), so this story adds no separate import test; `npm run lint`
enforces it. `src/config/**` must still not import `zod` or `src/adapter/**`.

**ADR-05 / ADR-27(d):** "The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70."
**R-4:** "Mitigations are one test per AC-045 example and Stryker on `config/**`."

**ADR-29, test-strategy #7 (merge rule, verbatim):** "every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient."

**Downstream consumers:** ST-004 (per-route merge, `validateRequests`, `onValidationError`,
`validateResponses`), ST-006 (`openapi.info/servers/tags`, `securitySchemes`, `security`,
`autoDetect.include/exclude`, `detectedDefaultResponse`, `operationIdStrategy`, `tagStrategy`),
ST-007 (public export of `DEFAULT_OPTIONS`, `ApiDocsConfigError`; `specPath`, `docsPath`, `ui`,
`cdnUrl`, `serveSpec`, `serveDocs`, `docs.specUrl`; AC-036 resolved-config equality, AC-043 and
AC-045 "throws before mount"), ST-008 (README table parity against `OPTION_SPEC` paths). Export
these from `src/config/*`: `ApiDocsOptions`, `OPTION_SPEC`, `OptionRow`, `OptionPath`,
`DEFAULT_OPTIONS`, `validateOptions`, `mergeOptions`, `ApiDocsConfigError`. ST-007 owns the public
barrels (`src/index.ts`, `src/manual.ts`); do not edit them.

**Options that must have rows (from PRD ACs; names provisional per A-6, behavior binding):**
`specPath` (default `/openapi.json`, must start with `/`), `docsPath` (default `/docs`, must start with `/`),
`ui` (`'scalar'` default | `'swagger-ui'`), `cdnUrl`, `serveSpec` (default true), `serveDocs` (default true),
`docs.specUrl`, `openapi.info` (title, version, description), `openapi.servers`, `openapi.tags`,
`securitySchemes`, `security`, `validateRequests` (default true, A-7), `validateResponses`
(unset/false default | `'warn'` | `'error'`), `onValidationError`, `autoDetect` (default on, A-1;
`false` or `{ include, exclude }` globs), `detectedDefaultResponse`, `operationIdStrategy`, `tagStrategy`.
No option selects a schema adapter by importing zod; the default adapter is ST-003's
`standardSchemaAdapter` (ADR-21), wired by ST-007.

**Assumptions (prd.md):** A-8 "config errors throw `ApiDocsConfigError` synchronously." A-9
"`serveSpec: false` with `serveDocs: true` throws `ApiDocsConfigError` at setup unless `docs.specUrl` is set explicitly."

## Acceptance criteria (from PRD)

- **AC-036:** Given the package exports, When `DEFAULT_OPTIONS` is imported, Then it is a deep-frozen object whose values deep-equal the resolved config of `createApiDocs()` with no options. It contains a default for every option listed in AC-037 to AC-042. *(This story: deep-frozen + row per option; the resolved-config equality is ST-007.)*
- **AC-038:** Given overrides of `openapi.info` (title, version, description), `openapi.servers` and `openapi.tags`, When the spec is generated, Then the spec's `info`, `servers` and `tags` equal the overridden values. *(This story: options accepted, validated and merged; spec side is ST-006.)*
- **AC-039:** Given `securitySchemes` with a bearer scheme and a global `security: [{ bearer: [] }]`, When the spec is generated, Then every operation that has no route-level `security` inherits the global requirement, and a route declaring `security: []` has an empty `security` array in its operation. *(This story: options + merge where route `[]` replaces global.)*
- **AC-040:** Given `validateRequests: false` globally, When an invalid request is sent to a typed route, Then the handler is called and no 400 is returned. Given a global `onValidationError` formatter with validation on, When validation fails, Then the formatter's status and body are returned. (`validateResponses` modes are covered by AC-012 to AC-014.) *(This story: options accepted and validated; runtime is ST-004.)*
- **AC-041:** Given `autoDetect` with `include: ['/api/**']` and a custom `detectedDefaultResponse` (e.g. status `204`, description `No Content`), When the spec is generated, Then only plain routes under `/api/` are auto-detected, and each detected operation's responses equal the custom default. *(This story: options accepted and validated.)*
- **AC-042:** Given custom `operationIdStrategy` and `tagStrategy` functions, When the spec is generated, Then every operation without an explicit `operationId` or tags (both typed and auto-detected) uses the functions' return values. With neither option set, the defaults in A-3 and A-4 apply (e.g. `GET /users/:id` produces `getUsersById` with tag `users`). *(This story: options accepted; functions replace, not merge.)*
- **AC-044 (a, b):** Given defaults, global options and per-route options that overlap, When the effective options for a route are resolved, Then the precedence is per-route over global over defaults, as a deep merge in which arrays are replaced, not concatenated. Tests cover: (a) a global `openapi.info.title` override keeps the default `info.version`; (b) global `tags: ['a','b']` with per-route `tags: ['c']` yields `['c']`.
- **AC-045:** Given `createApiDocs()` called with an unknown key (e.g. `specPth`) or an invalid value (e.g. `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), When setup runs, Then it throws synchronously, before mounting any route, an exported `ApiDocsConfigError` whose message contains the offending option path and the allowed values or type. *(This story: `validateOptions()` throws; "before mounting" is ST-007.)*
- **AC-046:** Given a TypeScript consumer, When it passes an unknown key or a wrongly typed value to `createApiDocs()` or to per-route options, Then `tsc --noEmit` reports an error (verified by type tests with `@ts-expect-error`), and all options are optional in the exported `ApiDocsOptions` type.

## Test plan

Write these FIRST; capture the failing run (red) in the Builder Report before any `src/config` code.
The epic's S-02 obligations are exactly these four files: `validate`, `merge`, `defaults`, `options.test-d`.

1. `test/config/validate.test.ts`
   - `rejects unknown key specPth` → throws `ApiDocsConfigError`; message contains `specPth`.
   - `rejects ui 'redoc'` → message contains `ui` and both `scalar` and `swagger-ui`.
   - `rejects validateResponses 'maybe'` → message contains `validateResponses` and `warn`, `error`.
   - `rejects specPath 'no-slash'` → message contains `specPath` and the expected form (starts with `/`).
   - `rejects nested unknown key` (e.g. `openapi.infoo`) → message contains the dotted path.
   - `A-9 (C1 cross-field rule): serveSpec false + serveDocs true without docs.specUrl throws` → message names `serveSpec` and `docs.specUrl`.
   - `A-9: same with docs.specUrl set does not throw`; `serveSpec false + serveDocs false does not throw`.
   - `accepts empty options` and `accepts a full valid options object` (AC-038..042 values incl. functions).
   - `throws synchronously` (not a rejected promise); `error instanceof Error` and `.name === 'ApiDocsConfigError'`, exposes `path` and `expected`.
2. `test/config/merge.test.ts`
   - `AC-044a: global openapi.info.title keeps default info.version`.
   - `AC-044b: global tags ['a','b'] + route tags ['c'] → ['c']`.
   - `route security [] replaces global security` (AC-039 merge side).
   - `functions replace` (operationIdStrategy), `primitives replace`, `inputs are not mutated`, `undefined does not override`.
3. `test/config/defaults.test.ts`
   - `DEFAULT_OPTIONS is deep-frozen` (recursive `Object.isFrozen` on every nested object/array).
   - `has a row for every option in AC-037..AC-042` (explicit list of paths asserted present in `OPTION_SPEC`).
   - `defaults: specPath '/openapi.json', docsPath '/docs', ui 'scalar', validateRequests true, validateResponses off, autoDetect on, serveSpec/serveDocs true`.
   - `DEFAULT_OPTIONS passes validateOptions()`.
4. `test/config/options.test-d.ts` (run by `vitest --typecheck`)
   - `@ts-expect-error` on unknown key `specPth`; on `ui: 'redoc'`; on `validateResponses: 'maybe'`; on `validateRequests: 'yes'`.
   - `const o: ApiDocsOptions = {}` compiles (all optional); per-route options type likewise rejects unknown keys.
   - `expectTypeOf<Required<...>>` style check that each top-level key is optional.

Import boundary (no `zod`, no `adapter/**` in `src/config/**`) is enforced by S-01's ADR-21 ESLint rule via `npm run lint`; no separate test file.

## Verification commands

Copied verbatim from architecture.md:

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)

**Merge rule (ADR-29, test-strategy #7):** run the **full** `npm test` (including global coverage
thresholds) in this story's worktree before merge; a focused `test/config` run is not sufficient.
Record the command, exit code and summary in the Builder Report.

## Builder Report

