---
id: ST-004
title: "Typed route, request/response validation, async wrapping, problem+json, RouteRegistry implementation"
wave: 3
status: queued
attempts: 0
ac_ids:
  - "AC-006"
  - "AC-007"
  - "AC-008"
  - "AC-009"
  - "AC-010"
  - "AC-011"
  - "AC-012"
  - "AC-013"
  - "AC-014"
  - "AC-021"
  - "AC-024"
  - "AC-040"
  - "AC-044"
depends_on:
  - "ST-002"
  - "ST-003"
file_scope:
  owns:
    - "src/route/typed.ts"
    - "src/route/validate-request.ts"
    - "src/route/validate-response.ts"
    - "src/route/async.ts"
    - "src/route/problem.ts"
    - "src/registry/**"
    - "test/route/**"
    - "test/registry/**"
  creates:
    - "src/route/"
    - "src/registry/"
    - "test/route/"
    - "test/registry/"
---

# ST-004 (epic S-04): Typed route, request/response validation, async wrapping, problem+json, RouteRegistry implementation

Epic id: S-04. The schema requires the `ST-NNN` pattern, so the frontmatter uses `ST-004`, `ST-002` (= S-02) and `ST-003` (= S-03).
Risk: **medium** (epic.md): "`res.json`/`send` delegation, exact-once error forwarding on both majors".
Components: C3 and C12. Wave 3, solo. S-05 (Wave 4) depends on this story (ADR-27b), and S-06 consumes `RouteRegistry.entries()`.

## Context

The repo is greenfield (context pack `.aidd/context/snapshot.md`), so the owned files do not exist yet. By Wave 3 the following exist from earlier stories. Import them. Do not edit them.

- `src/core/types.ts` (S-01, C0), quoted from architecture.md: "`HttpMethod`, `OperationMeta` (the per-route declaration), `DetectedOperation {method, path, pathParams[], source: 'typed'|'describe'|'plain', meta?}`, `Logger`, and `META: unique symbol`. There is no logic here." Per ADR-20 it also holds the four `Symbol.for` identities: "`META = Symbol.for('express-api-docs.meta')`, `MOUNT = ...`, `CHILD = ...` and `RECORDER = ...`". Per ADR-27c it holds the pinned `RouteRegistry` contract (below).
- `src/config/**` (S-02, C1): "`mergeOptions(defaults, global, route)`: plain objects recurse; arrays, functions and primitives replace." `DEFAULT_OPTIONS` is deep-frozen. `validateOptions()` throws `ApiDocsConfigError(path, expected)`.
- `src/adapter/**` (S-03, C2): "`SchemaAdapter<S> { name; isSchema(x): x is S; validate(s, input): {ok:true,data}|{ok:false,issues:{path,message}[]}; toJSONSchema(s, io:'input'|'output'); }` plus a type-level `Infer<S>` hook." Per ADR-21 the core default is `standardSchemaAdapter` (`src/adapter/standard.ts`), which "validates via `schema['~standard'].validate`"; `zodAdapter` (`src/adapter/zod.ts`) is only reachable through the `./zod` subpath. Route code must use the `SchemaAdapter` port and must **not** import `zod` (ESLint `no-restricted-imports` on `src/**` except `src/adapter/zod.ts`, ADR-21). Tests may import `zod` to build schemas.

### Component C3 (architecture.md, verbatim)
> `route(meta, handler)` returns `[validator, wrapAsync(handler)]`. Per-route options are resolved once, at definition time. Validators are pre-bound. The handler is tagged with `[META]`. Request errors produce RFC 9457 `problem+json` with `errors[{in: path|query|body, path, message}]`, or the value of `onValidationError`. `res.json` is wrapped **only** when `validateResponses !== false`. Wrapping `res.json` also covers `res.send(object)`, because Express's `send` delegates objects to `json`; raw strings and streams are documented as not validated. `wrapAsync` sends rejections to `next(err)`, which gives the same behaviour on Express 4 and 5.

### Component C12 (architecture.md, verbatim)
> `registry/registry.ts`: Per-instance `RouteRegistry` for typed and `describe()` routes, populated at declaration (ADR-17)

### ADR-17 (excerpt, verbatim)
> A per-instance `RouteRegistry` records typed and `describe()` routes at declaration, as `{method, localPath, meta, validatorFn, handlerFn}`. It lives in **`src/registry/registry.ts` (new component C12, owned by S-04 typed-route)**; `describe.ts` (S-05) only calls its `register()` API. The stack walk (C5) does exactly two things: (a) attach mount prefixes by matching layer handles by identity against the registered `validatorFn` **or** `handlerFn`; (b) find plain routes.

### ADR-27c pinned seam (architecture.md "Pinned seams (ADR-27)", verbatim) — implement exactly this
> (c) `RouteRegistry` contract in `src/core/types.ts` (owner: S-01; implementation: S-04 `src/registry/registry.ts`; consumers: S-05, S-06):

```ts
export interface RegistryEntry {
  readonly id: number;                 // registration order, for A-3 collision suffixes
  readonly method: HttpMethod;
  readonly localPath: string;          // Express syntax, as declared
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
  readonly validatorFn?: RequestHandler; // typed only
  readonly handlerFn: RequestHandler;
}
export interface RouteRegistry {
  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry;
  entries(): readonly RegistryEntry[];                    // registration order
  findByHandle(fn: unknown): RegistryEntry | undefined;   // identity match on validatorFn OR handlerFn
}
```

`src/registry/registry.ts` must `implements RouteRegistry` imported from `src/core/types.ts`; it must not redeclare the interface. If the contract is insufficient, record a request in the Builder Report (S-01 owns `core/types.ts`).

### ADR-03 (accepted parts, verbatim)
> validators pre-bound per route, per-route options resolved once at definition time, and no `res.json` wrap when `validateResponses` is false.

### ADR-29 obligations owned by this story (verbatim)
> **CR-7:** `test/route/send-delegation.test.ts` asserts, on both majors, that `res.send(invalidObject)` is validated when `validateResponses: 'error'`.

> **Test-strategy #4:** the AC-024 test asserts that the error middleware is called **exactly once** on both majors, plus a direct unit test of `wrapAsync`, which forwards rejections to `next` and does not call it again after headers are sent.

> **Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient.

### ADR-27d (verbatim)
> The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70.

### Constraints
- Do not edit `package.json`, `src/core/types.ts`, `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `src/route/describe.ts` (S-05), `src/config/**` or `src/adapter/**`. Record any dependency request in the Builder Report.
- Use the `META` symbol from `core/types.ts` (a `Symbol.for` identity, ADR-20). Never create a local `Symbol()` for a value that crosses module boundaries (ESLint `no-restricted-syntax`).
- Shared Express 4/5 fixtures (`test/fixtures/**`, including `majors.ts`) belong to S-05, which runs later. Put a local parameterizer inside `test/route/` (e.g. `test/route/_express.ts`) that imports `express` (v5.2.1) and `express4` (`npm:express@4.22.3`, ADR-13), dedupes by detected major (as ADR-25 describes, so the `express: 4` CI cell does not run "v5" cases on v4), and runs runtime tests via `describe.each`.
- Keep the registry API exactly as pinned: S-05 calls `register()` (source `'describe'`, no `validatorFn`); S-05 calls `findByHandle()`; S-06 calls `entries()` and uses `id` for A-3 collision suffixes.
- Mutation testing (Stryker, break at 70) covers `src/route/**` and `src/registry/**` (ADR-05, ADR-27d). Tests must assert exact values, not just truthiness.
- AC-011 (the spec 400 `$ref`) is emitted by S-06. This story only provides the ProblemDetails JSON schema/shape constant and media-type constant from `problem.ts` that S-06 will reference.
- Merge rule (ADR-29 #7): the full `npm test` with global 90/90/90/90 thresholds must pass in this story's worktree.

## Acceptance criteria (from PRD)

- **AC-006**: Given a route defined with the typed helper and Zod schemas for params, query, body and response, When the handler is type-checked, Then `req.params`, `req.query` and `req.body` have the inferred types, and assigning a wrong type fails `tsc --noEmit` (verified by a type test with `@ts-expect-error`).
- **AC-007**: Given a typed route with a body schema, When a request with an invalid body is sent, Then the response is 400 with `Content-Type: application/problem+json` and a body containing `type`, `title`, `status: 400`, `detail`, and `errors[]` where each entry has `in`, `path` and `message`, and the handler is not called.
- **AC-008**: Given invalid params, query, or body (each tested separately), When the request is sent, Then each `errors[].in` value is `path`, `query` or `body` respectively.
- **AC-009**: Given a valid request, When it is sent, Then the handler receives the parsed (coerced) values and the response is the one the handler produced.
- **AC-010**: Given an `onValidationError` hook is configured, When validation fails, Then the hook's response replaces the default 400 problem body.
- **AC-011** (problem schema part only): Given any typed route with a request schema, When the spec is generated, Then that operation includes a `400` response that references the problem-details schema with media type `application/problem+json`.
- **AC-012**: Given `validateResponses` is unset, When a handler returns a body that violates its response schema, Then the body is sent unchanged and nothing is logged.
- **AC-013**: Given `validateResponses: 'warn'`, When a handler returns a body that violates its response schema, Then the body is sent unchanged and exactly one warning is written through the configured logger.
- **AC-014**: Given `validateResponses: 'error'`, When a handler returns a body that violates its response schema, Then the client receives a 500 response and the invalid body is not sent.
- **AC-021**: Given an existing Express `Router` with plain routes, When one typed route is mounted on it, Then the plain routes still respond as before and only the typed route validates.
- **AC-024**: Given the test suite runs against Express 4 and Express 5, When an async typed handler throws, Then the error reaches Express's error middleware in both versions.
- **AC-040**: Given `validateRequests: false` globally, When an invalid request is sent to a typed route, Then the handler is called and no 400 is returned. Given a global `onValidationError` formatter with validation on, When validation fails, Then the formatter's status and body are returned. (`validateResponses` modes are covered by AC-012 to AC-014.)
- **AC-044** (cases c and d only): Given defaults, global options and per-route options that overlap, When the effective options for a route are resolved, Then the precedence is per-route over global over defaults, as a deep merge in which arrays are replaced, not concatenated. Tests cover all four of these cases: (a) a global `openapi.info.title` override keeps the default `info.version`; (b) global `tags: ['a','b']` with per-route `tags: ['c']` yields `['c']`; (c) per-route `validateResponses: 'error'` beats global `'warn'`; (d) a per-route `onValidationError` beats the global one. (Cases a and b are covered by S-02.)

## Test plan

Write these tests FIRST and capture them failing (red) before writing any `src/` code. Every runtime test runs on each detected Express major (4 and 5) through `describe.each` over the local parameterizer. Logger assertions use a dedicated logger spy per test.

1. `test/route/typed.test-d.ts` (AC-006)
   - `infers params/query/body`: `expectTypeOf(req.params.id)`, `req.query`, `req.body` match `z.infer` of each schema.
   - `rejects wrong assignment`: `// @ts-expect-error` on `const n: number = req.params.id` (string schema), and on a wrong-typed `res.json(...)` if the response is typed.
   - Red: fails at `--typecheck` because `route` does not exist.
2. `test/route/request-validation.test.ts` (AC-007, 008, 009, 010, 040, 044d)
   - `invalid body -> 400 problem+json`: status 400; `content-type` matches `application/problem+json`; body has `type`, `title`, `status === 400`, `detail`; `errors[0]` has exactly keys `in`, `path`, `message`. Handler spy called 0 times.
   - `errors[].in per location`: three separate cases give `'path'`, `'query'` and `'body'`.
   - `valid request gets coerced values`: a coerced-number query arrives in the handler as the number `5`; the handler's response is returned verbatim.
   - `global onValidationError replaces body` (AC-010, AC-040): the formatter's status (e.g. 422) and body are returned.
   - `per-route onValidationError beats global` (AC-044d): only the per-route hook's output is sent; the global spy is called 0 times.
   - `validateRequests:false`: an invalid request gives 200 and the handler is called exactly once.
3. `test/route/response-validation.test.ts` (AC-012, 013, 014, 044c)
   - `unset -> unchanged, silent`: invalid body sent byte-equal; every logger method spy called 0 times.
   - `validateResponses:false -> res.json not wrapped` (ADR-03): `res.json` inside the handler is the original Express function (identity check).
   - `'warn' -> unchanged + exactly one warn`: `logger.warn` called exactly 1 time.
   - `'error' -> 500, body withheld`: status 500; response body does not contain the invalid payload.
   - `per-route 'error' beats global 'warn'` (AC-044c): 500, and `warn` called 0 times.
4. `test/route/send-delegation.test.ts` (CR-7, ADR-29; AC-014)
   - On both majors, with `validateResponses: 'error'`, `res.send(invalidObject)` yields 500 and the invalid payload is not sent.
   - `res.send(validObject)` yields 200 with the object as JSON.
   - `res.send('raw string')` is passed through unvalidated (documented limit in C3).
5. `test/route/async.test.ts` (AC-024, ADR-29 test-strategy #4)
   - `async throw reaches error middleware exactly once`: an `async` handler throws `new Error('boom')`; a 4-arity error middleware spy is called **exactly 1 time** with that same error instance (`toBe`), on both majors.
   - `rejected promise reaches error middleware exactly once`: same assertion for a returned rejected promise.
6. `test/route/wrap-async.test.ts` (ADR-29 test-strategy #4, unit)
   - `forwards rejection to next`: with a mock `next`, a rejecting handler results in `next` called once with the rejection reason.
   - `sync throw forwarded`: a synchronously throwing handler results in `next(err)` once.
   - `no second next after headers sent`: when `res.headersSent === true` before the rejection, `next` is not called again (call count stays at its prior value).
   - `resolved handler does not call next`: `next` called 0 times.
7. `test/route/incremental.test.ts` (AC-021)
   - A Router with plain `GET /plain` and `POST /plain`, plus one typed `POST /typed`. An invalid body to `/plain` gives the plain handler's normal response (not 400). Only `/typed` returns 400.
8. `test/route/problem.test.ts` (AC-011, problem schema part)
   - The exported ProblemDetails schema has `type`, `title`, `status`, `detail`, and `errors` items `{in, path, message}` with `in` enum `['path','query','body']`; the media-type constant equals `'application/problem+json'`.
9. `test/registry/registry.test.ts` (C12, ADR-17, ADR-27c conformance)
   - `register returns entry with id`: returned entry has `id`, `method`, `localPath`, `source`, `meta`, `validatorFn`, `handlerFn` equal to the input plus `id`.
   - `ids in registration order`: three registrations get strictly increasing ids; `entries()` returns them in that order.
   - `findByHandle on validatorFn` and `findByHandle on handlerFn` return the same entry (`toBe`); an unknown fn and non-function input return `undefined`.
   - `describe-source entry without validatorFn`: `register({source:'describe', ...})` without `validatorFn` is found by `handlerFn`.
   - `instances are isolated`: two registries do not share entries.
   - `entries() is read-only to callers`: mutating the returned array does not change a subsequent `entries()` result.
   - `route() registers at declaration`: calling `route(...)` with a registry adds exactly one `source: 'typed'` entry whose `validatorFn`/`handlerFn` are `toBe` the returned tuple elements, and the handler carries `[META]` from `core/types.ts`.
   - Type conformance: `const r: RouteRegistry = createRegistry()` compiles (the class/factory satisfies the pinned interface).

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

Story-focused red/green loop: `npx vitest run --typecheck test/route test/registry`. This is not sufficient for merge: the full `npm test` (with global thresholds) must pass in this worktree (ADR-29 #7), and `npm run mutation` must meet `thresholds.break: 70` over `src/route/**` and `src/registry/**`.

## Builder Report

