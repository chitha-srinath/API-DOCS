---
id: ST-003
title: "S-03 SchemaAdapter port, Standard Schema default adapter, Zod adapter and memoization"
wave: 2
status: ready
attempts: 0
ac_ids:
  - "AC-004"
  - "AC-005"
  - "AC-006"
  - "AC-016"
  - "AC-035"
depends_on:
  - "ST-001"
file_scope:
  owns:
    - "src/adapter/**"
    - "test/adapter/**"
  creates:
    - "src/adapter/"
    - "test/adapter/"
---

# ST-003 (epic S-03) — SchemaAdapter port, Standard Schema default adapter, Zod adapter and memoization

> Id note: epic.md names this story `S-03`; the frontmatter schema requires `^ST-[0-9]{3}$`,
> so it is recorded as `ST-003`. `depends_on: ST-001` = epic `S-01` (scaffold).
> Risk (epic risk table, verbatim): "medium | New Standard Schema path (ADR-21); `~standard.jsonSchema` conformance on Zod 4.x".
> Wave 2 runs in parallel with S-02 (`src/config/**`, `test/config/**`); do not touch those.
> AC scope (epic S-03 row, verbatim): "AC-004 (Zod adapter behind the `./zod` subpath), AC-005, AC-006 (Infer hook), AC-016 (schema conversion), AC-035 (Zod accepted with zero options)".

## Context

Greenfield repo (context pack: "the repo is greenfield"). S-01 has already produced
`package.json` (zod as an **optional peer** `^4.0.0` plus a zod devDependency, vitest 5.0.2 with
`--typecheck`), `tsconfig*.json`, `eslint.config.js` and `src/core/types.ts`. You may READ
`src/core/types.ts` but must not edit it (owned by S-01). You may NOT edit `package.json`,
`eslint.config.js`, `stryker.config.mjs` or `vitest.config.ts` (S-01). If something is missing,
record the request in the Builder Report.

**Files to create (exactly these six sources, epic ownership row S-03 plus ADR-31):**
`src/adapter/types.ts`, `src/adapter/standard.ts`, `src/adapter/standard-types.ts`,
`src/adapter/zod.ts`, `src/adapter/memo.ts`, `src/adapter/errors.ts`, plus tests under
`test/adapter/`. All fall inside the owned glob `src/adapter/**`.

Do NOT create or edit `src/index.ts`, `src/manual.ts` or `src/zod.ts`. Epic, verbatim:
"| `./zod` subpath barrel | 21 | S-07 | `src/zod.ts` |" and "Wave 6: S-07. It depends on S-03
because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath."
So export `standardSchemaAdapter` from `src/adapter/standard.ts`, `zodAdapter` from
`src/adapter/zod.ts` and `ApiDocsSchemaError` from `src/adapter/errors.ts` under exactly those
names. S-07 re-exports `ApiDocsSchemaError` from the public entries (ADR-31: "exported").

### Architecture C2 (verbatim, architecture.md)

> | C2 | `adapter/types.ts`, `adapter/standard.ts`, `adapter/standard-types.ts`, `adapter/memo.ts`, `adapter/zod.ts`, `zod.ts` (subpath entry) | `SchemaAdapter<S> { name; isSchema(x): x is S; validate(s, input): {ok:true,data}\|{ok:false,issues:{path,message}[]}; toJSONSchema(s, io:'input'\|'output'); }` plus a type-level `Infer<S>` hook. **Core default:** `standardSchemaAdapter` via `~standard.validate` / `~standard.jsonSchema` with types vendored in `standard-types.ts` (ADR-21; edge behaviour ADR-31). **Subpath only:** `zodAdapter` (`adapter/zod.ts`, exposed through `src/zod.ts` → `express-api-docs/zod`) uses `safeParse` and `z.toJSONSchema(s, { target: 'draft-2020-12', io, unrepresentable: 'any' })`; it is the only file allowed to import `zod`. `memo.ts` wraps any adapter with `WeakMap<schema, JSONSchema>` memoization. ... | 005, 006, 016, 035 | ... | S-03 adapter |

Note: C2 lists `zod.ts` (subpath entry), but the epic ownership table gives `src/zod.ts` to S-07. Follow the epic: do not create `src/zod.ts`.

### ADR-21 (verbatim excerpt; amends ADR-04, C2 and C9)

> • **Peers:** `zod` becomes an **optional peer**: `peerDependencies.zod: ^4.0.0` plus `peerDependenciesMeta.zod.optional: true`. The core (`.` entry) **never imports `zod`**. An ESLint `no-restricted-imports` rule on `src/**` except `src/adapter/zod.ts` enforces this, and a pack test greps `dist/index.{js,cjs}` for `zod`.
> • **Default adapter:** the core ships `standardSchemaAdapter` (`src/adapter/standard.ts`, S-03). It validates via `schema['~standard'].validate` and converts via `schema['~standard'].jsonSchema.{input,output}({ target: 'draft-2020-12' })`. The Standard Schema type definitions are vendored as types only, in `src/adapter/standard-types.ts`, so there is no runtime dependency.
> • **Result:** zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core.
> • **Zod subpath:** `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` (`src/zod.ts` → `adapter/zod.ts`). It adds Zod-specific handling: `unrepresentable: 'any'` and typed `z.infer`.

ADR-21 probe output (verbatim, architecture.md):

```
keys [ 'validate', 'vendor', 'version', 'jsonSchema' ]
validate {"value":{"id":3}}
```

### ADR-31 (verbatim excerpt; Standard Schema adapter edge behaviour)

> • **(1) Async `validate`: AMENDED.** ... The amended rule: `standardSchemaAdapter.validate` **throws** `ApiDocsSchemaError` (exported, code `EAD_ASYNC_SCHEMA`, naming the route and the schema vendor). Before throwing, it attaches a no-op `.catch` to the returned Promise, so there is no unhandled rejection. The C3 validator already runs inside `wrapAsync`, so the error reaches `next(err)` and the client gets a **500**. The same error is raised at definition time if an optional probe detects an async refinement. `ApiDocsSchemaError` lives in `src/adapter/errors.ts` (S-03).
> • **(2) Missing `jsonSchema`: ACCEPTED.** When `~standard.jsonSchema` is absent (or its `input`/`output` call throws), `toJSONSchema` returns `{}` and emits exactly one `warn` per schema identity, code `EAD_SCHEMA_NO_JSONSCHEMA`, through the configured logger. The `WeakMap` memo in `memo.ts` guarantees the once-per-schema rule.

Why (ADR-31, verbatim): "An `{ok:false}` result would be turned into a **400 problem+json that blames the client** for a server-side schema choice (AC-007 semantics)" and "`{}` is a valid JSON Schema, so AC-015 still passes. It degrades docs, not runtime".

### ADR-03 (excerpt, verbatim)

> It covers a `WeakMap<schema, JSONSchema>` in `adapter/memo.ts` ... Memoizing in a wrapper keeps adapters trivial, which helps AC-005 stubs. ... hash hoisting endangers AC-016 output shape and AC-034 byte identity.

### ADR-04 (excerpt, verbatim)

"`config/**` must not import `zod` or `adapter/**`". Keep `src/adapter/**` self-contained: it may
import only `src/core/types.ts` (read-only) and, **in `src/adapter/zod.ts` only**, `zod`.

### ADR-27(d) (verbatim)

"The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70."

### ADR-29 test-strategy #7 (verbatim)

"every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient."

### R-7 (verbatim)

"`z.toJSONSchema` with `unrepresentable: 'any'` emits `{}` for transforms and custom types, so the docs are lossy by design."

### Design requirements derived from the above

- `types.ts`: export `SchemaAdapter<S>` (the pinned C2 contract, unchanged), `ValidationResult<T>` (`{ok:true,data:T} | {ok:false,issues:{path:string,message:string}[]}`), `JSONSchema`, `SchemaIO = 'input' | 'output'`, and the type-level `Infer<S>` hook (Standard: `StandardSchemaV1.InferOutput<S>`; Zod: `z.output<S>`).
- `standard-types.ts`: vendored Standard Schema V1 types (**types only**, no runtime code, no imports), including the `~standard.jsonSchema.{input,output}` shape.
- `errors.ts`: export `class ApiDocsSchemaError extends Error` with `readonly code: 'EAD_ASYNC_SCHEMA'`, `name = 'ApiDocsSchemaError'`, and fields `vendor: string` and `route?: string`. The message names the vendor and, when known, the route. Export the code constants `EAD_ASYNC_SCHEMA` and `EAD_SCHEMA_NO_JSONSCHEMA`.
- `standard.ts`: export `standardSchemaAdapter: SchemaAdapter<StandardSchemaV1>`, `name: 'standard'`.
  - `isSchema` is true only for objects whose `~standard` has a `validate` function.
  - `validate` calls `schema['~standard'].validate(input)`. `{value}` maps to `{ok:true,data:value}`. `{issues}` maps to `{ok:false,issues}`, with each `path` joined to a string (segments may be `PropertyKey` or `{key}`).
  - **Async result (ADR-31 (1)):** if the result is thenable, first call `result.catch(() => {})`, then `throw new ApiDocsSchemaError(...)` with code `EAD_ASYNC_SCHEMA` and `vendor = schema['~standard'].vendor`. Never return `{ok:false}` for this case. The adapter does not know the route, so S-04's validator may set `route` on the error or wrap it. The error then goes through `wrapAsync` → `next(err)` → 500.
  - **`toJSONSchema` (ADR-31 (2)):** calls `s['~standard'].jsonSchema[io]({ target: 'draft-2020-12' })`. If `jsonSchema` is absent, or the call throws, it returns `{}` and marks the result as degraded. It must not log by itself. The warn is emitted once per schema by `memo.ts`, as described below.
  - **Must not import `zod`** (ADR-21 lint rule).
- `zod.ts`: export `zodAdapter: SchemaAdapter<z.ZodType>`, `name: 'zod'`. `isSchema` is false for non-Zod values. `validate` uses `safeParse` and joins `issue.path` with `.`. `toJSONSchema` calls `z.toJSONSchema(s, { target: 'draft-2020-12', io, unrepresentable: 'any' })`. This is the only `src/**` file that imports `zod`.
- `memo.ts`: export `memoizeAdapter<S extends object>(a: SchemaAdapter<S>, logger?: { warn(msg: string, meta?: object): void }): SchemaAdapter<S>`.
  - Caches in `WeakMap<schema, …>` with separate entries per `io`.
  - `validate`, `isSchema` and `name` pass through, so an async throw propagates unchanged.
  - When the inner result is degraded, it calls `logger.warn` with code `EAD_SCHEMA_NO_JSONSCHEMA` **exactly once per schema identity**, across both `io` values (tracked with a `WeakSet<schema>`), and caches a fresh `{}`.
  - Recommended degraded marker: `standard.ts` returns an exported frozen sentinel `NO_JSON_SCHEMA`, which `memo.ts` detects by identity and replaces with a fresh `{}`. Any equivalent mechanism is fine if it does not change the pinned `SchemaAdapter` contract.
- No runtime dependency. No logic in `src/core/types.ts`.

## Acceptance criteria (from PRD)

- **AC-004** — Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 \|\| ^5.0.0` and `zod` `^4.0.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed. *(This story delivers only the Zod adapter behind the `./zod` subpath and a zod-free `standard.ts`/`errors.ts`. The manifest belongs to S-01; the barrels and load tests belong to S-07.)*
- **AC-005** — Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code. *(This story delivers the port and contract suite.)*
- **AC-006** — Given a route defined with the typed helper and Zod schemas for params, query, body and response, When the handler is type-checked, Then `req.params`, `req.query` and `req.body` have the inferred types, and assigning a wrong type fails `tsc --noEmit` (verified by a type test with `@ts-expect-error`). *(This story delivers only the `Infer` hook.)*
- **AC-016** — Given a route `/users/:id` with params, query, body and response schemas, When the spec is generated, Then the path appears as `/users/{id}` with a `path` parameter `id` (required), query parameters, a `requestBody` and response schemas derived from the Zod schemas. *(This story delivers only schema conversion.)*
- **AC-035** — Given an Express app set up with `createApiDocs()` and no options, plus one typed route, When the app is started, Then `GET /openapi.json` returns 200 with a valid OpenAPI 3.1 spec (as in AC-015), `GET /docs` returns 200 HTML loading Scalar, an invalid request to the typed route returns 400 problem+json, and responses are not validated. *(This story delivers only the default `standardSchemaAdapter` accepting Zod v4 schemas; the end-to-end test belongs to S-07.)*

## Test plan

Write these FIRST. Run `npx vitest run test/adapter --typecheck` and capture the failing (red)
output before writing any `src/adapter` code. Expected red: module-not-found for `../../src/adapter/*`.
The two ADR-31 cases (tests 3 and 4) must each be shown red on their own.

1. `test/adapter/contract.test.ts` (AC-005) — `describe.each` over `standardSchemaAdapter`, `zodAdapter`, a hand-written non-Zod stub (schemas `{ kind: 'stub', required: string[] }`) and `memoizeAdapter(stub)`:
   - `isSchema` is true for the adapter's own schema and false for `{}`, `null`, `42` and a foreign schema.
   - Valid input gives `{ok:true}` with `data`.
   - Invalid input gives `{ok:false}` with non-empty `issues`, each with a string `path` and `message`. A nested error has `path` `'user.name'`.
   - `toJSONSchema(s, 'input'|'output')` returns plain objects.
2. `test/adapter/standard.test.ts` (ADR-21, AC-035):
   - `validate(z.object({ id: z.coerce.number() }), { id: '3' })` deep-equals `{ ok: true, data: { id: 3 } }`.
   - `toJSONSchema(z.object({ id: z.string() }), 'input')` has `$schema` `https://json-schema.org/draft/2020-12/schema` and `required: ['id']`.
   - `'input'` and `'output'` differ for a `.default('x')` field.
   - Neither `standard.ts`, `standard-types.ts` nor `errors.ts` contains `from 'zod'` or `require('zod')` (read the files as text).
3. `test/adapter/async-schema.test.ts` (ADR-31 (1)):
   - A hand-built Standard Schema (`vendor: 'acme'`) whose `validate` returns a rejecting Promise: `standardSchemaAdapter.validate` **throws** an `ApiDocsSchemaError` with `code === 'EAD_ASYNC_SCHEMA'` and a message containing `acme`. It does not return a value.
   - With a `process.on('unhandledRejection')` spy, after `await new Promise(r => setImmediate(r))` the spy was not called (proves the no-op `.catch`).
   - Asserts `z.object({ a: z.string().refine(async () => true) })` through `standardSchemaAdapter` also throws `EAD_ASYNC_SCHEMA`.
   - Asserts `memoizeAdapter(standardSchemaAdapter).validate` propagates the same error.
   - `err instanceof ApiDocsSchemaError` and `err instanceof Error`.
   - The 500 via `next(err)` is asserted by S-04; it is out of this story's scope.
4. `test/adapter/no-jsonschema.test.ts` (ADR-31 (2)), with a logger spy `{ warn: vi.fn() }`:
   - A schema with no `~standard.jsonSchema`: `memoizeAdapter(standardSchemaAdapter, logger).toJSONSchema(s, 'input')` deep-equals `{}`.
   - A schema whose `jsonSchema.output` throws: the result deep-equals `{}` and nothing is thrown.
   - Calling `'input'` twice, then `'output'`, on the same schema gives `logger.warn` called **exactly once** for that schema, with code `EAD_SCHEMA_NO_JSONSCHEMA` (filter the spy calls on the code).
   - Two distinct degraded schemas give two warns.
   - A healthy schema gives zero warns.
   - Returned `{}` objects are not the shared sentinel (mutating one does not affect the next schema's result).
5. `test/adapter/memo.test.ts` (ADR-03) — spy on the inner `toJSONSchema`:
   - The same schema and `io` twice gives one inner call and `toBe`-identical results.
   - A different `io` gives two calls.
   - Different schemas give separate entries.
   - `validate` is delegated on every call.
6. `test/adapter/zod-jsonschema.test.ts` (AC-016, R-7):
   - `z.object({ id: z.string() })` gives draft 2020-12 `$schema`, `type: 'object'` and `required: ['id']`.
   - With `.default('x')`, the field is optional in `'input'` and required in `'output'`.
   - `transform`/`z.custom()` yields `{}` without throwing.
7. `test/adapter/infer.test-d.ts` (AC-006 hook) — `expectTypeOf<Infer<typeof schema>>()` equals `{ id: string }` for the Standard and Zod paths. A `// @ts-expect-error` assigning `{ id: 1 }` must be present.

Tests must kill mutants in `src/adapter/**` (ADR-27d). Before merge, run the full `npm test` (ADR-29 #7).

## Verification commands

Copied verbatim from architecture.md "Verification Commands":

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story (the CLIs themselves were probed below)
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Story-focused run (red/green evidence only): `npx vitest run test/adapter --typecheck`.
Merge gate: full `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run mutation` (scope includes `src/adapter/**`, ADR-27d).

## Builder Report

