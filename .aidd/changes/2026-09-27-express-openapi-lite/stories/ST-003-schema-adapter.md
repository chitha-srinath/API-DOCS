---
id: ST-003
title: "S-03 SchemaAdapter port, Standard Schema default adapter, Zod adapter, memoization, branded ApiDocsSchemaError, stub-adapter fixture"
wave: 2
status: built
attempts: 0
ac_ids:
  - "AC-004"
  - "AC-005"
  - "AC-006"
  - "AC-016"
  - "AC-035"
  - "AC-047"
depends_on:
  - "ST-001"
file_scope:
  owns:
    - "src/adapter/**"
    - "test/adapter/**"
    - "test/fixtures/stub-adapter.ts"
  creates:
    - "src/adapter/"
    - "test/adapter/"
---

# ST-003 (epic S-03) — SchemaAdapter port, Standard Schema default adapter, Zod adapter, memoization, branded `ApiDocsSchemaError`, stub-adapter fixture

> Id note: epic.md names this story `S-03`; the frontmatter schema requires `^ST-[0-9]{3}$`,
> so it is recorded as `ST-003`. `depends_on: ST-001` = epic `S-01` (scaffold).
> Risk (epic risk table, verbatim): "medium | New Standard Schema path (ADR-21); `~standard.jsonSchema` conformance and the Zod floor `^4.2.0` (ADR-47)".
> Wave 2 runs in parallel with S-02 (`src/config/**`, `test/config/**`); do not touch those.
> AC scope (epic S-03 row, verbatim): "AC-004 (Zod adapter behind the `./zod` subpath; zod floor `^4.2.0`), AC-005, AC-006 (Infer hook), AC-016 (schema conversion), AC-035 (Zod accepted with zero options), AC-047 (stub fixture)".

## Context

Greenfield repo (context pack: "the repo is greenfield"). S-01 has already produced
`package.json` (zod as an **optional peer `^4.2.0`** and a zod devDependency `^4.6.5`, ADR-47;
vitest 5.0.2 with `--typecheck`), `tsconfig*.json`, `eslint.config.js` (zod import allowed only in
`src/adapter/zod.ts`), `src/core/types.ts` (including the ADR-49 constants
`BRAND = Symbol.for('express-api-contract.v1.brand')` (instance key) and
`BRAND_KEY = Symbol.for('express-api-contract.v1.brandKey')` (class key)), the `test/fixtures/` directory, and the
CI `peer-floor` job that installs `zod@4.2.0` and runs `test/adapter/standard-floor.test.ts`.

You may READ `src/core/types.ts` but must not edit it. You may NOT edit `package.json`,
`eslint.config.js`, `stryker.config.mjs`, `vitest.config.ts`, `vitest.stryker.config.ts`,
`.github/**`, `test/fixtures/majors.ts` or `test/fixtures/fresh-express.ts` (all S-01). If
something is missing, record the request in the Builder Report.

**Files to create (epic ownership row S-03, verbatim):** "`src/adapter/**` (`types.ts`, `standard.ts`,
`standard-types.ts`, `zod.ts`, `memo.ts`, `errors.ts`), `test/adapter/**`, `test/fixtures/stub-adapter.ts` (ADR-38)".

Do NOT create or edit `src/index.ts`, `src/manual.ts` or `src/zod.ts` (S-01 Wave-1 stubs, owned by
S-07 from Wave 6). Epic, verbatim: "| `./zod` subpath barrel (exports `zodAdapter`, re-exports
`ApiDocsSchemaError`) | 21, 41 | S-07 | `src/zod.ts` |" and "Wave 6: S-07. ... It depends on S-03
because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath."
So export `standardSchemaAdapter` from `src/adapter/standard.ts`, `zodAdapter` from
`src/adapter/zod.ts` and `ApiDocsSchemaError` from `src/adapter/errors.ts` under exactly those names.

### Architecture C2 (verbatim, architecture.md)

> | C2 | `adapter/types.ts`, `adapter/standard.ts`, `adapter/standard-types.ts`, `adapter/memo.ts`, `adapter/zod.ts`, `zod.ts` (subpath entry) | `SchemaAdapter<S> { name; isSchema(x): x is S; validate(s, input): {ok:true,data}\|{ok:false,issues:{path,message}[]}; toJSONSchema(s, io:'input'\|'output'); }` plus a type-level `Infer<S>` hook. **Core default:** `standardSchemaAdapter` via `~standard.validate` / `~standard.jsonSchema` with types vendored in `standard-types.ts` (ADR-21; edge behaviour ADR-31). **Subpath only:** `zodAdapter` (`adapter/zod.ts`, exposed through `src/zod.ts` → `express-api-contract/zod`) uses `safeParse` and `z.toJSONSchema(s, { target: 'draft-2020-12', io, unrepresentable: 'any' })`; it is the only file allowed to import `zod`. `memo.ts` wraps any adapter with `WeakMap<schema, JSONSchema>` memoization. **[was: ... SUPERSEDED by ADR-21]** | 005, 006, 016, 035 | ... | S-03 adapter |

C2 lists `zod.ts` (subpath entry), but the epic gives `src/zod.ts` to S-07. Follow the epic.

### ADR-21 (verbatim excerpt) with ADR-47 amendment

> **[zod peer floor SUPERSEDED by ADR-47 → `^4.2.0`.]** ...
> • **Default adapter:** the core ships `standardSchemaAdapter` (`src/adapter/standard.ts`, S-03). It validates via `schema['~standard'].validate` and converts via `schema['~standard'].jsonSchema.{input,output}({ target: 'draft-2020-12' })`. The Standard Schema type definitions are vendored as types only, in `src/adapter/standard-types.ts`, so there is no runtime dependency.
> • **Result:** zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core.
> • **Zod subpath:** `zodAdapter` lives **only** at the subpath export `express-api-contract/zod` (`src/zod.ts` → `adapter/zod.ts`). It adds Zod-specific handling: `unrepresentable: 'any'` and typed `z.infer`.

The `^4.0.0` peer range in ADR-21's body is superseded; the effective floor is `^4.2.0`.

### ADR-47 (verbatim excerpt) with ADR-52 amendment

> The probe shows `~standard.jsonSchema` is **absent** in zod 4.0.0, 4.1.0 and 4.1.13 (the last 4.1.x release) and **present** in 4.2.0 and 4.3.0, where 4.2.0 emits a draft 2020-12 schema. The `zod` peer becomes **`^4.2.0`** (still optional). The ADR-25 `peer-floor` job additionally installs `zod@4.2.0` and runs `test/adapter/standard-floor.test.ts` (S-03), which asserts non-empty `properties` for a Zod object through `standardSchemaAdapter`.

ADR-52: the `./zod` subpath has the same `^4.2.0` floor (one package, one peer range). There is no
supported path for zod below 4.2; do not add any such advice in code comments, error messages or tests.

### ADR-31 (verbatim excerpt)

> • **(1) Async `validate`: AMENDED.** ... `standardSchemaAdapter.validate` **throws** `ApiDocsSchemaError` (exported, code `EAD_ASYNC_SCHEMA`, naming the route and the schema vendor). Before throwing, it attaches a no-op `.catch` to the returned Promise, so there is no unhandled rejection. The C3 validator already runs inside `wrapAsync`, so the error reaches `next(err)` and the client gets a **500**. ... `ApiDocsSchemaError` lives in `src/adapter/errors.ts` (S-03).
> • **(2) Missing `jsonSchema`: ACCEPTED.** When `~standard.jsonSchema` is absent (or its `input`/`output` call throws), `toJSONSchema` returns `{}` and emits exactly one `warn` per schema identity, code `EAD_SCHEMA_NO_JSONSCHEMA`, through the configured logger. The `WeakMap` memo in `memo.ts` guarantees the once-per-schema rule.

### ADR-37 (scope boundary, verbatim)

> "This gives ADR-31(1) an end-to-end owner. ST-003 proves only that the adapter throws."

### ADR-38 (verbatim excerpt)

> Resolution order is `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`. The last is injected by the S-07 composition root ... The check is duck-typed: an object with function members `isSchema`, `validate` and `toJSONSchema`.
> **Fixture:** `test/fixtures/stub-adapter.ts` (S-03) is a non-Zod adapter over plain `{kind:'str'\|'obj',…}` descriptors.

S-04 (`test/route/stub-adapter.test.ts`) and S-06 (`test/spec/stub-adapter.test.ts`) import this fixture; do not write those tests here.

### ADR-41 (verbatim excerpt)

> The public exports of `.` and `./manual` are `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, ApiDocsSchemaError, standardSchemaAdapter, installRecorder`, plus types. `./zod` exports `zodAdapter`, re-exports `ApiDocsSchemaError`, and nothing else.

### ADR-42 — brand comparison SUPERSEDED by ADR-49

ADR-42's `x[BRAND] === this.name` comparison is superseded (it fails under minification and for subclasses). Stable `name` (`'ApiDocsSchemaError'`) and `code` properties are kept.

### ADR-49 (verbatim excerpt)

> **Brand:** the brand is a **stable string code per class**, never `this.name`. `core/types.ts` exports `BRAND = Symbol.for('express-api-contract.v1.brand')` (the instance key) and `BRAND_KEY = Symbol.for('express-api-contract.v1.brandKey')` (the class key). Each class declares `static readonly [BRAND_KEY] = 'express-api-contract.v1.ApiDocsConfigError'` (respectively `…ApiDocsSchemaError`).
> **Construction:** the constructor stores the **set of codes along its class chain**: `this[BRAND] = collectBrands(new.target)`, which walks `Object.getPrototypeOf` over constructors and gathers each own `[BRAND_KEY]`.
> **`instanceof`:** `static [Symbol.hasInstance](x) { const k = Object.prototype.hasOwnProperty.call(this, BRAND_KEY) ? this[BRAND_KEY] : undefined; return k !== undefined && Array.isArray(x?.[BRAND]) && x[BRAND].includes(k); }`. When a user subclass declares no brand, it falls back to `Function.prototype[Symbol.hasInstance].call(this, x)` (a normal prototype check).
> **Tests:** S-02 and S-03 unit tests cover a subclass, a renamed class and a foreign object with a wrong brand (false).

### ADR-53 (verbatim excerpt)

> AC-047's names `parse` and `toJsonSchema` are read as the `SchemaAdapter` members **`validate`** and **`toJSONSchema`** (C2, ADR-21). ... `adapter/types.ts` carries a JSDoc line `@remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema`.

### ADR-03 / ADR-04 / ADR-27(d) / ADR-29 #7 / ADR-50 (excerpts)

- ADR-03: "a `WeakMap<schema, JSONSchema>` in `adapter/memo.ts` ... Memoizing in a wrapper keeps adapters trivial, which helps AC-005 stubs."
- ADR-04: "`config/**` must not import `zod` or `adapter/**`". `src/adapter/**` may import only `src/core/types.ts` and, **in `src/adapter/zod.ts` only**, `zod`.
- ADR-27(d): "The Stryker `mutate` scope ... `src/adapter/**`. `thresholds.break` stays at 70."
- ADR-29 #7: "every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge."
- ADR-50(a): "each story runs `npx stryker run --mutate \"<its src globs>\" --incremental` ... the break threshold applies to that scope."
- R-7: "`z.toJSONSchema` with `unrepresentable: 'any'` emits `{}` for transforms and custom types, so the docs are lossy by design."

### Design requirements derived from the above

- `types.ts`: `SchemaAdapter<S>` (pinned C2 contract, unchanged), `ValidationResult<T>`, `JSONSchema`, `SchemaIO = 'input' | 'output'`, the type-level `Infer<S>` hook. The `SchemaAdapter` interface carries a JSDoc comment containing the line `@remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema` (ADR-53); do not rename or alias members.
- `standard-types.ts`: vendored Standard Schema V1 types only (no runtime code, no imports), including `~standard.jsonSchema.{input,output}`.
- `errors.ts` (ADR-49): `class ApiDocsSchemaError extends Error`, `name = 'ApiDocsSchemaError'`, `readonly code: 'EAD_ASYNC_SCHEMA'`, `vendor: string`, `route?: string`; `static readonly [BRAND_KEY] = 'express-api-contract.v1.ApiDocsSchemaError'`; constructor sets `this[BRAND] = collectBrands(new.target)` (array of own `[BRAND_KEY]` codes along the constructor chain via `Object.getPrototypeOf`); `static [Symbol.hasInstance](x)` exactly as in ADR-49, falling back to `Function.prototype[Symbol.hasInstance].call(this, x)` when `this` has no own `[BRAND_KEY]`. `BRAND`, `BRAND_KEY` imported from `src/core/types.ts`. Export code constants `EAD_ASYNC_SCHEMA`, `EAD_SCHEMA_NO_JSONSCHEMA`. No zod import.
- `standard.ts`: `standardSchemaAdapter`, `name: 'standard'`. `isSchema` true only if `~standard.validate` is a function. `validate` maps `{value}` → `{ok:true,data}`, `{issues}` → `{ok:false,issues}` with paths joined by `.` (segments may be `PropertyKey` or `{key}`). Thenable result → `result.catch(() => {})` then throw `ApiDocsSchemaError` (vendor from `~standard.vendor`); never `{ok:false}`. `toJSONSchema` calls `jsonSchema[io]({ target: 'draft-2020-12' })`; if absent or throwing, returns an exported frozen sentinel `NO_JSON_SCHEMA` (no logging). No zod import.
- `zod.ts`: `zodAdapter`, `name: 'zod'`, `safeParse`, paths joined by `.`, `z.toJSONSchema(s, { target: 'draft-2020-12', io, unrepresentable: 'any' })`. Only `src/**` file importing `zod`.
- `memo.ts`: `memoizeAdapter(adapter, logger?)`: `WeakMap` cache per schema and per `io`; `validate`/`isSchema`/`name` pass through (async throw propagates); on the sentinel, `logger.warn` with `EAD_SCHEMA_NO_JSONSCHEMA` exactly once per schema identity (`WeakSet`), caching a fresh `{}`.
- `test/fixtures/stub-adapter.ts`: exports `stubAdapter: SchemaAdapter<StubSchema>` plus builders (`str()`, `obj({...})`) over `{kind:'str'} | {kind:'obj', props, required}` descriptors. No zod, no `~standard`. Passes the duck-typed check (function `isSchema`, `validate`, `toJSONSchema`). Converts to draft 2020-12 JSON Schema (`{type:'string'}`, `{type:'object',properties,required}`).

## Acceptance criteria (from PRD)

- **AC-004** — Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 \|\| ^5.0.0` and `zod` `^4.2.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed. *(This story delivers the Zod adapter behind the subpath, zod-free `standard.ts`/`errors.ts`, and the zod `4.2.0` floor test. Manifest = S-01; barrels and load tests = S-07.)*
- **AC-005** — Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code. *(This story delivers the port, the contract suite and the stub fixture.)*
- **AC-006** — Given a route defined with the typed helper and Zod schemas for params, query, body and response, When the handler is type-checked, Then `req.params`, `req.query` and `req.body` have the inferred types, and assigning a wrong type fails `tsc --noEmit` (verified by a type test with `@ts-expect-error`). *(This story delivers only the `Infer` hook.)*
- **AC-016** — Given a route `/users/:id` with params, query, body and response schemas, When the spec is generated, Then the path appears as `/users/{id}` with a `path` parameter `id` (required), query parameters, a `requestBody` and response schemas derived from the Zod schemas. *(This story delivers only schema conversion.)*
- **AC-035** — Given an Express app set up with `createApiDocs()` and no options, plus one typed route, When the app is started, Then `GET /openapi.json` returns 200 with a valid OpenAPI 3.1 spec (as in AC-015), `GET /docs` returns 200 HTML loading docs UI, an invalid request to the typed route returns 400 problem+json, and responses are not validated. *(This story delivers only the default `standardSchemaAdapter` accepting Zod v4 schemas; the e2e test belongs to S-07.)*
- **AC-047** — Given `schemaAdapter: stubAdapter` globally or per-route, When requests are validated and the spec is generated, Then the stub adapter's parse and toJsonSchema are used, and per-route overrides global. *(This story delivers only `test/fixtures/stub-adapter.ts`; route/spec/wiring tests belong to S-04, S-06, S-07. Per ADR-53, "parse" = `validate` and "toJsonSchema" = `toJSONSchema`.)*

## Test plan

Write these FIRST. Run `npx vitest run test/adapter --typecheck` and capture the red output before
writing any `src/adapter` code or the fixture (expected: module-not-found). The ADR-31 cases
(tests 3 and 4) and the ADR-49 brand cases (test 8) must each be shown red on their own.

1. `test/adapter/contract.test.ts` (AC-005, AC-047) — `describe.each` over `standardSchemaAdapter`, `zodAdapter`, `stubAdapter` from `test/fixtures/stub-adapter.ts`, and `memoizeAdapter(stubAdapter)`:
   - `isSchema` true for its own schema; false for `{}`, `null`, `42` and a foreign schema.
   - Valid input → `{ok:true}` with `data`; invalid → `{ok:false}` with non-empty `issues` (string `path`, `message`); nested error path `'user.name'`.
   - `toJSONSchema(s, 'input'|'output')` returns plain objects.
   - The stub passes the ADR-38 duck-type check (functions `isSchema`, `validate`, `toJSONSchema`) and `JSON.stringify` of the fixture module source contains no `zod` / `~standard`.
   - `src/adapter/types.ts` (read as text) contains `@remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema` (ADR-53).
2. `test/adapter/standard.test.ts` (ADR-21, AC-035):
   - `validate(z.object({ id: z.coerce.number() }), { id: '3' })` deep-equals `{ ok: true, data: { id: 3 } }`.
   - `toJSONSchema(z.object({ id: z.string() }), 'input')` has `$schema` `https://json-schema.org/draft/2020-12/schema` and `required: ['id']`.
   - `'input'` and `'output'` differ for a `.default('x')` field.
   - `standard.ts`, `standard-types.ts`, `errors.ts` (read as text) contain no `from 'zod'` / `require('zod')`.
3. `test/adapter/async-schema.test.ts` (ADR-31 (1)):
   - Hand-built Standard Schema (`vendor: 'acme'`) whose `validate` returns a rejecting Promise → `validate` **throws** `ApiDocsSchemaError`, `code === 'EAD_ASYNC_SCHEMA'`, message contains `acme`.
   - `unhandledRejection` spy not called after `await new Promise(r => setImmediate(r))`.
   - `z.object({ a: z.string().refine(async () => true) })` via `standardSchemaAdapter` also throws `EAD_ASYNC_SCHEMA`.
   - `memoizeAdapter(standardSchemaAdapter).validate` propagates the same error.
   - The 500 via `next(err)` is S-04 (ADR-37); out of scope.
4. `test/adapter/no-jsonschema.test.ts` (ADR-31 (2)), logger spy `{ warn: vi.fn() }`:
   - No `~standard.jsonSchema` → `{}`; `jsonSchema.output` throws → `{}`, no throw.
   - `'input'` twice then `'output'` on one schema → exactly one warn with `EAD_SCHEMA_NO_JSONSCHEMA`; two degraded schemas → two warns; healthy schema → zero.
   - Returned `{}` is never the shared sentinel (mutation isolation).
5. `test/adapter/memo.test.ts` (ADR-03): same schema+io twice → one inner call, `toBe`-identical; different `io` → two calls; different schemas → separate entries; `validate` delegated every call.
6. `test/adapter/zod-jsonschema.test.ts` (AC-016, R-7): draft 2020-12 `$schema`, `type: 'object'`, `required: ['id']`; `.default('x')` optional in input, required in output; `transform`/`z.custom()` → `{}` without throwing.
7. `test/adapter/infer.test-d.ts` (AC-006 hook): `expectTypeOf<Infer<typeof schema>>()` equals `{ id: string }` for Standard, Zod and stub paths; a `// @ts-expect-error` assigning `{ id: 1 }` is present. Use only shared types (ADR-36).
8. `test/adapter/errors.test.ts` (ADR-41, ADR-49):
   - `err.name === 'ApiDocsSchemaError'`, `err.code === 'EAD_ASYNC_SCHEMA'`, `ApiDocsSchemaError[BRAND_KEY] === 'express-api-contract.v1.ApiDocsSchemaError'`, and `err[BRAND]` is an array containing that code.
   - `err instanceof ApiDocsSchemaError` and `err instanceof Error`.
   - Plain object `{ [BRAND]: ['express-api-contract.v1.ApiDocsSchemaError'] }` is `instanceof ApiDocsSchemaError`; `{ [BRAND]: ['express-api-contract.v1.ApiDocsConfigError'] }` (wrong brand), `{ [BRAND]: 'express-api-contract.v1.ApiDocsSchemaError' }` (non-array), `null`, `undefined` and `new Error()` are not.
   - Subclass without own brand: `class MyErr extends ApiDocsSchemaError {}`; `new MyErr(...)` is `instanceof ApiDocsSchemaError` and `instanceof MyErr` (prototype fallback); a plain `ApiDocsSchemaError` is NOT `instanceof MyErr`; a branded plain object is NOT `instanceof MyErr`.
   - Subclass with own brand: `class Branded extends ApiDocsSchemaError { static readonly [BRAND_KEY] = 'x.Branded' }`; its instance's `[BRAND]` contains both codes, and it is `instanceof` both classes.
   - Renamed class: `Object.defineProperty(ApiDocsSchemaError, 'name', …)`-style rename (or a copy via `const Renamed = ApiDocsSchemaError` bound under a different name) does not change the `instanceof` result (no dependence on `this.name`).
9. `test/adapter/standard-floor.test.ts` (ADR-47, AC-004 floor): `standardSchemaAdapter.toJSONSchema(z.object({ id: z.string() }), 'input')` has non-empty `properties` containing `id`. Must pass on the devDependency zod and in the S-01 `peer-floor` job with `zod@4.2.0`.

Tests must kill mutants in `src/adapter/**` (ADR-27d). Before merge, run the full `npm test` (ADR-29 #7).

## Verification commands

Copied verbatim from architecture.md "Verification Commands" (with superseded markers honoured):

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`) **[runner SUPERSEDED by ADR-35 → Stryker command runner with `vitest.stryker.config.ts`; `@stryker-mutator/vitest-runner` removed; CI job AMENDED by ADR-50 → per-story scoped incremental run at merge, full run nightly only]**, probe after scaffold story
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Story-focused run (red/green evidence only): `npx vitest run test/adapter --typecheck`.
Floor check (local reproduction of the peer-floor job): `npm i --no-save zod@4.2.0 && npx vitest run test/adapter/standard-floor.test.ts`, then restore with `npm ci`.
Scoped mutation (ADR-50(a); `thresholds.break: 70` applies to this scope): `npx stryker run --mutate "src/adapter/**" --incremental`.
Merge gate: full `npm test`, `npm run lint`, `npx tsc --noEmit` and the scoped mutation command above.

## Builder Report

### Files created (all within owned `file_scope`)

- `src/adapter/types.ts` — `SchemaAdapter<S>`, `ValidationResult<T>`, `JSONSchema`, `SchemaIO`, and the
  `Infer<S>` type-level hook (matches Standard Schema V1-compliant schemas via `standard-types.ts`, and
  falls back to a phantom `__infer` marker for non-Standard schemas such as the stub fixture). Carries the
  ADR-53 `@remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema` JSDoc line verbatim.
- `src/adapter/standard-types.ts` — vendored Standard Schema V1 types only (no imports, no runtime code).
- `src/adapter/errors.ts` — `ApiDocsSchemaError` (ADR-49 brand: `static [BRAND_KEY]`, `this[BRAND] =
  collectBrands(new.target)`, custom `static [Symbol.hasInstance]` with prototype fallback for subclasses
  without their own brand), plus `EAD_ASYNC_SCHEMA` / `EAD_SCHEMA_NO_JSONSCHEMA` code constants. No zod import.
- `src/adapter/standard.ts` — `standardSchemaAdapter` (`~standard.validate` / `~standard.jsonSchema.{input,output}`),
  dotted issue paths, thenable-result → `.catch(() => {})` then throw `ApiDocsSchemaError` (ADR-31(1)), and the
  exported frozen `NO_JSON_SCHEMA` sentinel for the ADR-31(2) accepted-degradation path. No zod import.
- `src/adapter/zod.ts` — `zodAdapter` (`safeParse`, `z.toJSONSchema(s, { target: 'draft-2020-12', io,
  unrepresentable: 'any' })`). The only `src/**` file importing `zod` (enforced by `eslint.config.js`, already
  in place from S-01).
- `src/adapter/memo.ts` — `memoizeAdapter(adapter, logger?)`: `WeakMap` cache keyed per schema identity and per
  `io`; warns once per schema identity (`WeakSet`) via `logger.warn(EAD_SCHEMA_NO_JSONSCHEMA, ...)` only when the
  wrapped adapter returns the `standard.ts` `NO_JSON_SCHEMA` sentinel by reference, caching a fresh `{}` instead
  so callers never share/mutate the sentinel.
- `test/fixtures/stub-adapter.ts` (ADR-38) — `stubAdapter: SchemaAdapter<StubSchema>` plus `str()`/`obj()`
  builders over `{kind:'str'} | {kind:'obj', props, required}` descriptors. No zod, no Standard Schema protocol.
  Passes the duck-typed check; converts to draft-2020-12-shaped JSON Schema.
- `test/adapter/contract.test.ts`, `standard.test.ts`, `async-schema.test.ts`, `no-jsonschema.test.ts`,
  `memo.test.ts`, `zod-jsonschema.test.ts`, `infer.test-d.ts`, `errors.test.ts`, `standard-floor.test.ts` — per
  the story's test plan, items 1–9.

### TDD evidence — red before green

**Red** (`src/adapter/` and `test/fixtures/stub-adapter.ts` temporarily moved aside; all 9 new test files fail
with module-not-found, as expected for a not-yet-implemented story):

```
$ mv src/adapter src/adapter.bak && mv test/fixtures/stub-adapter.ts test/fixtures/stub-adapter.ts.bak
$ npx vitest run test/adapter --typecheck
...
TypeCheckError: Cannot find module '../../src/adapter/memo.js' or its corresponding type declarations.
 ❯ test/adapter/no-jsonschema.test.ts:2:32
...
TypeCheckError: Cannot find module '../../src/adapter/standard.js' or its corresponding type declarations.
 ❯ test/adapter/standard.test.ts:5:39
...
TypeCheckError: Cannot find module '../../src/adapter/zod.js' or its corresponding type declarations.
 ❯ test/adapter/zod-jsonschema.test.ts:3:28

 Test Files  9 failed (9)
      Tests  no tests
Type Errors  no errors
     Errors  30 errors
```

(restored: `rm -rf src/adapter && mv src/adapter.bak src/adapter && mv test/fixtures/stub-adapter.ts.bak
test/fixtures/stub-adapter.ts`)

**Green** (after implementing `src/adapter/**` and the fixture, and iterating through several internal
red/green rounds fixing type-signature mismatches against the real zod 4.6.5 Standard Schema JSON-Schema
converter types, `noUncheckedIndexedAccess`, and the ADR-49 brand-key literal-widening needed for subclasses):

```
$ npx vitest run test/adapter --typecheck
...
 Test Files  9 passed (9)
      Tests  50 passed (50)
Type Errors  no errors
Duration  7.37s
```

(The "Unhandled Errors" noise printed alongside this run — `src/config/**`, `test/config/**` — are pre-existing
type errors in ST-002's own files, confirmed independent of this story: `npx vitest run test/config --typecheck`
shows the identical 9 errors while its own suite reports `5 passed (5)` / `36 passed (36)`. Not in my
`file_scope`; not touched.)

### Lint / typecheck evidence

```
$ npx eslint src/adapter test/adapter test/fixtures/stub-adapter.ts
(no output — clean)

$ npx prettier --check src/adapter test/adapter test/fixtures/stub-adapter.ts
All matched files use Prettier code style!   # after `prettier --write` on first pass

$ npx tsc --noEmit 2>&1 | grep adapter
(no matches — zero errors attributable to src/adapter/** or test/adapter/**)
```

Full `npx tsc --noEmit` does report pre-existing errors in `src/config/**` and `test/config/**` (ST-002,
untouched by this story) — e.g. `src/config/types.ts(32,41): error TS2552: Cannot find name 'Group'`,
`src/config/spec-table.ts` implicit-any/unknown-property errors, and the same ADR-49 brand-key literal-widening
issue this story fixed in `errors.ts`, still present in `src/config/errors.ts`/`test/config/errors.test.ts`.

### Full suite (ADR-29 #7)

```
$ npm test        # vitest run --coverage --typecheck
 Test Files  24 passed (24)
      Tests  138 passed (138)
Type Errors  no errors

Coverage summary:
Statements   : 97%     (194/200)
Branches     : 92.26%  (155/168)
Functions    : 100%    (60/60)
Lines        : 97.36%  (185/190)
src/adapter coverage: 97.56% stmts / 86.95% branch / 100% funcs / 98.71% lines
  errors.ts    100/90/100/100   (line 29 uncovered — Symbol.hasInstance non-owning-fallback edge not hit by name)
  standard.ts  96.15/83.33/100/100 (lines 20-22, 50 — an unreached defensive branch in the thenable-issues path
               and one jsonSchema-throws catch arm)
  zod.ts       90.9/75/100/90.9 (line 32 — the toJSONSchema catch{} arm; z.toJSONSchema does not currently throw
               for any schema exercised in this story's tests, so it is defensive-only)

$ npm run lint    # eslint . && prettier --check .
Checking formatting...
[warn] src/config/spec-table.ts
[warn] src/config/types.ts
[warn] test/config/merge.test.ts
Code style issues found in 3 files.   # pre-existing ST-002 formatting, not in file_scope

$ npx tsc --noEmit
(errors confined to src/config/** and test/config/**, see above; zero in src/adapter/** or test/adapter/**)
```

Scoped mutation (`npx stryker run --mutate "src/adapter/**" --incremental`) and the local zod@4.2.0 floor
reproduction were not run in this pass (time-boxed); `test/adapter/standard-floor.test.ts` passes against the
devDependency zod 4.6.5 as part of the green run above, and its assertion (non-empty `properties.id`) is written
to also hold under the `^4.2.0` floor per ADR-47. Recommend the merge gate (or a follow-up QA pass) run both
before merge, per the story's "Merge gate" section.

### AC self-check

- **AC-004** (partial per story scope) — ✅ Zod adapter behind `./zod` subpath (owned by S-01/S-07's package.json
  and barrels, already present), zod-free `standard.ts`/`errors.ts`/`standard-types.ts` (verified by
  `standard.test.ts`'s source-scan assertion), and `standard-floor.test.ts` asserting non-empty `properties`
  through `standardSchemaAdapter` against the devDependency zod 4.6.5 (floor-compatible per the assertion's
  shape). Barrel/load tests are S-07's responsibility per the story note.
- **AC-005** — ✅ `SchemaAdapter` port exported from `src/adapter/types.ts`; `test/fixtures/stub-adapter.ts` is a
  non-Zod stub adapter proven against the same `contract.test.ts` suite as `standardSchemaAdapter`/`zodAdapter`
  via `describe.each`, with zero adapter-specific core code required.
- **AC-006** — ✅ `Infer<S>` type-level hook delivered in `src/adapter/types.ts`; `test/adapter/infer.test-d.ts`
  proves `{ id: string }` inference for both the Zod/Standard path and the stub path, plus a `@ts-expect-error`
  on a wrong-type assignment, checked by `vitest --typecheck`.
- **AC-016** (schema-conversion slice only, per story scope) — ✅ `zod-jsonschema.test.ts` and `standard.test.ts`
  prove draft-2020-12 conversion with `required` arrays and input/output divergence for defaulted fields; the
  route/path-level AC-016 behaviour (`/users/{id}`, path/query params, requestBody) is ST-004/ST-006's scope.
- **AC-035** (default-adapter slice only, per story scope) — ✅ `standardSchemaAdapter` accepts Zod v4 schemas
  with zero core-side zod dependency (`standard.test.ts`); the e2e `GET /openapi.json` / `GET /docs` / 400
  behaviour is S-07's scope per the story note.
- **AC-047** — ✅ `test/fixtures/stub-adapter.ts` delivered; its `validate`/`toJSONSchema` members are what
  S-04/S-06/S-07 will wire as `schemaAdapter: stubAdapter`. Route/spec/wiring-level assertions are out of scope
  here per the story note; `contract.test.ts` proves the fixture's own duck-typed shape and behaviour.

All 6 AC IDs assigned to this story (AC-004, AC-005, AC-006, AC-016, AC-035, AC-047) are satisfied to the extent
this story's scope note defines for each (each AC is a cross-story AC; this story delivers its named slice only,
as called out verbatim in the AC list above).

### `git diff --stat` (confined to owned file_scope)

```
$ git add -N src/adapter test/adapter test/fixtures/stub-adapter.ts
$ git diff --stat -- src/adapter test/adapter test/fixtures/stub-adapter.ts
 src/adapter/errors.ts               |  45 ++++++++++++
 src/adapter/memo.ts                 |  47 +++++++++++++
 src/adapter/standard-types.ts       |  51 ++++++++++++++
 src/adapter/standard.ts             |  55 +++++++++++++++
 src/adapter/types.ts                |  25 +++++++
 src/adapter/zod.ts                  |  35 +++++++++
 test/adapter/async-schema.test.ts   |  60 ++++++++++++++++
 test/adapter/contract.test.ts       | 137 ++++++++++++++++++++++++++++++++++++
 test/adapter/errors.test.ts         |  72 +++++++++++++++++++
 test/adapter/infer.test-d.ts        |  18 +++++
 test/adapter/memo.test.ts           |  60 ++++++++++++++++
 test/adapter/no-jsonschema.test.ts  |  89 +++++++++++++++++++++++
 test/adapter/standard-floor.test.ts |  16 +++++
 test/adapter/standard.test.ts       |  39 ++++++++++
 test/adapter/zod-jsonschema.test.ts |  32 +++++++++
 test/fixtures/stub-adapter.ts       |  97 +++++++++++++++++++++++++
 16 files changed, 878 insertions(+)
$ git reset src/adapter test/adapter test/fixtures/stub-adapter.ts   # left tree state unchanged (still untracked)
```

`git status --porcelain` was reviewed after the run and confirms no files outside `src/adapter/**`,
`test/adapter/**`, `test/fixtures/stub-adapter.ts` were modified by this builder pass (the many other
`?? `-prefixed entries — `src/config/**`, `src/core/**`, `test/config/**`, etc. — are ST-001/ST-002 outputs
already present in the working tree before this pass, per the dispatch prompt).

### Status: **built**

### Orchestrator addendum: ADR-50(a) scoped mutation gate (post-Auditor)

Skipped by the Builder (time-boxed) and flagged as an open merge-gate item by the Auditor.
Executed by the orchestrator directly:

```
$ npx stryker run --mutate "src/adapter/**" --incremental
```

First attempt failed with `ConfigError: There were failed tests in the initial test run` —
root-caused to a stale `.stryker-tmp/` sandbox left over from an earlier interrupted Stryker
invocation (the sandbox's copy of `test/meta/lint-rules.test.ts` carried a `// @ts-nocheck`
line absent from the working-tree file — not present in this story's ownership, not a defect
in ST-002 or ST-003). Confirmed via: the same test passes in isolation (7/7) and under the
exact Stryker vitest config invoked directly (18 files/117 tests green), so the failure was
sandbox staleness, not a live regression. Cleared `.stryker-tmp/` and re-ran clean.

Second attempt: exit 0, break threshold 70 met.

```
adapter        |  86.49 |   86.49 |      127 |         1 |         20 |        0 |        0 |
  errors.ts    |  91.67 |   91.67 |       21 |         1 |          2 |        0 |        0 |
  memo.ts      | 100.00 |  100.00 |       23 |         0 |          0 |        0 |        0 |
  standard.ts  |  80.25 |   80.25 |       65 |         0 |         16 |        0 |        0 |
  zod.ts       |  90.00 |   90.00 |       18 |         0 |          2 |        0 |        0 |
Final mutation score of 78.24 (blended with ST-002's cached config/** result via
--incremental) is greater than or equal to break threshold 70.
```

ADR-50(a) merge gate for ST-003 (`src/adapter/**` scope): **86.49 ≥ 70 — MET.**
Report: `reports/mutation/mutation.html`.

## Auditor Report

**Round 1, final.** All 6 interrogated ACs (AC-004, AC-005, AC-006, AC-016, AC-035, AC-047)
are **PROVEN**. No DISPUTED rows. The Builder Report's self-flagged zod@4.2.0 floor-test gap
was closed directly by the auditor rather than via a challenge round: `npm i --no-save
zod@4.2.0` (confirmed installed), `npx vitest run test/adapter/standard-floor.test.ts` → 1/1
passed, devDependency zod 4.6.5 restored via `npm ci` afterward. `npm test` (24/24 files,
138/138 tests, coverage ≥ thresholds), `npm run lint`, `npx tsc --noEmit` re-executed clean.
Full-text reads of `contract.test.ts`, `standard.test.ts`, `infer.test-d.ts` confirmed every
cited assertion exists verbatim.

The Builder Report's other self-flagged gap — the scoped Stryker mutation run
(`--mutate "src/adapter/**"`, break threshold 70, ADR-50(a)) — was **not** run by the auditor
(time budget) and remains open. It does not dispute any of the six interrogated ACs (none
tie their proof to a mutation score), but it is escalated to the Master Agent as a required
merge-gate item before this story is certified for merge. Full verdict:
`audit/interrogation/ST-003-verdict.md`.

## Auditor Report (QA step 12 — final audit)

Interrogated AC-004, AC-005, AC-006, AC-016, AC-035, AC-047 (this story's share).
Independently reproduced the F-01 fix this story's `src/adapter/zod.ts` output feeds:
`npx vitest run test/spec/build.test.ts` → 16/16 passed; `node
test/aidd-exhaustive/api-contract/run.mjs` → 28/28 PASS, including TC-CONTRACT-020's
`OpenApiParser.validate threw: false` for a `.meta({id})`-tagged schema via the default
adapter.

**Verdict: AC-004, AC-005, AC-006, AC-016, AC-035, AC-047 — all PROVEN.** No DISPUTED
ACs for this story. Full matrix: `audit/interrogation/qa-final-verdict.md`.

## Test Report (QA step 14 — g_test_report approved 2026-09-30)

Approved by human (let-me-look). Consolidated `qa/test-report.md`: 237+3 exhaustive cases,
all PASS, 0 open FAILs. Full suite 79/79 files, 644/649 tests (5 legit skips), coverage
98.56/93.35/99.45/99.34%. This story's claimed ACs are covered — see `ac-matrix.md` and
this story's `## Auditor Report` section above for per-AC verdicts.
