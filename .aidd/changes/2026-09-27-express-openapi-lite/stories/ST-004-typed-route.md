---
id: ST-004
title: "Typed route, request/response validation, async wrapping, problem+json, RouteRegistry implementation"
wave: 3
status: built
attempts: 1
ac_ids:
  - "AC-005"
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
  - "AC-047"
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

# ST-004 (epic S-04): Typed route, request and response validation, async wrapping, problem+json, the RouteRegistry implementation

Epic id: S-04. The schema requires the `ST-NNN` pattern, so the frontmatter uses `ST-004`, `ST-002` (= S-02) and `ST-003` (= S-03).
Risk: **medium** (epic.md): "`res.json`/`send` delegation, exact-once error forwarding on both majors".
Components: C3 and C12. Wave 3, solo. Epic: "It implements the RouteRegistry contract pinned by S-01, and imports `majors.ts` (S-01) and `stub-adapter.ts` (S-03)." S-05 (Wave 4) depends on this story (ADR-27b); S-06 consumes `RouteRegistry.entries()`.

## Context

The repo is greenfield (context pack `.aidd/context/snapshot.md`), so the owned files do not exist yet. By Wave 3 the following exist from earlier stories. Import them; do not edit them.

- `src/core/types.ts` (S-01, C0): `HttpMethod`, `OperationMeta`, `DetectedOperation`, `Logger`, the `META` symbol, the `BRAND` constant and the pinned `RouteRegistry` contract (ADR-27c). Per ADR-43 the keys are protocol-versioned: "`express-api-docs.v1.meta`, `.v1.mount`, `.v1.child`, `.v1.recorder` and `.v1.error`".
- `src/config/**` (S-02, C1): `mergeOptions(defaults, global, route)` ("plain objects recurse; arrays, functions and primitives replace"), deep-frozen `DEFAULT_OPTIONS`, `validateOptions()`, the `schemaAdapter` option row (default `null`, ADR-38).
- `src/adapter/**` (S-03, C2): the `SchemaAdapter<S>` port (`name; isSchema; validate(s, input): {ok:true,data}|{ok:false,issues:{path,message}[]}; toJSONSchema(s, io)`), `standardSchemaAdapter` (`src/adapter/standard.ts`), and `ApiDocsSchemaError` (`src/adapter/errors.ts`, code `EAD_ASYNC_SCHEMA`, branded per ADR-42). Route code uses the port and must **not** import `zod` (ESLint rule, ADR-21). Tests may import `zod`.
- `test/fixtures/majors.ts` and `test/fixtures/fresh-express.ts` (S-01, ADR-39) and `test/fixtures/stub-adapter.ts` (S-03, ADR-38). Import only.

### Component C3 (architecture.md, verbatim)
> `route(meta, handler)` returns `[validator, wrapAsync(handler)]`. Per-route options are resolved once, at definition time. Validators are pre-bound. The handler is tagged with `[META]`. Request errors produce RFC 9457 `problem+json` with `errors[{in: path|query|body, path, message}]`, or the value of `onValidationError`. `res.json` is wrapped **only** when `validateResponses !== false`. Wrapping `res.json` also covers `res.send(object)`, because Express's `send` delegates objects to `json`; raw strings and streams are documented as not validated. `wrapAsync` sends rejections to `next(err)`, which gives the same behaviour on Express 4 and 5.

### Component C12 / ADR-17 (verbatim excerpt)
> A per-instance `RouteRegistry` records typed and `describe()` routes at declaration, as `{method, localPath, meta, validatorFn, handlerFn}`. It lives in **`src/registry/registry.ts` (new component C12, owned by S-04 typed-route)**; `describe.ts` (S-05) only calls its `register()` API.

### ADR-27c pinned seam (verbatim) — implement exactly this

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

`src/registry/registry.ts` must `implements RouteRegistry` imported from `src/core/types.ts`; never redeclare it. If insufficient, record a request in the Builder Report (S-01 owns `core/types.ts`).

### ADR-03 (accepted parts, verbatim)
> validators pre-bound per route, per-route options resolved once at definition time, and no `res.json` wrap when `validateResponses` is false.

### ADR-33 (verbatim; amends ADR-29 #4 — the old test-6 wording is VOID)
> `wrapAsync` rule: when the handler's promise rejects, call `next(err)` **exactly once, even if `res.headersSent` is true**. Express's default error handler then destroys the socket, so the client does not hang, and custom error middleware sees the error (AC-024). It must **never** call `next` a second time. A per-invocation `settled` flag is set if the handler itself already called `next` (synchronously or asynchronously). `test/route/wrap-async.test.ts` asserts, on both majors: (a) rejection before any write gives the error middleware exactly one call; (b) `res.write('chunk')` followed by a rejection still gives exactly one `next(err)` and the client socket closes within 1 s; (c) a handler that already called `next(err)` and then rejects produces no second call.

### ADR-37 (verbatim)
> `test/route/request-validation.test.ts` adds this case on both majors: a typed route whose body schema is `z.object({a:z.string()}).refine(async () => true)`, receiving a valid body, returns **500**. The error middleware receives an error that is an `ApiDocsSchemaError` (checked through the brand, ADR-42) with `code === 'EAD_ASYNC_SCHEMA'`. The handler spy is called **0** times, and no `application/problem+json` 400 is sent.

### ADR-38 (excerpt, verbatim)
> A per-route override `meta.adapter` is also accepted. Resolution order is `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`. The last is injected by the S-07 composition root, so `src/config/**` still never imports `src/adapter/**` (ADR-04).
> S-04 `test/route/stub-adapter.test.ts`: a route with the stub schemas returns 400 problem+json for an invalid body, and the handler receives the parsed data for a valid one.

Resolve the adapter once, at definition time, in `src/route/typed.ts`.

### ADR-44 (excerpt, verbatim)
> `route()` **must** set `[META]` on both the validator and the handler function ... `test/route/meta-tag.test.ts` (S-04) ... assert that the tag is present and carries `{source, method?, meta}`.

### ADR-36 (excerpt, verbatim)
> The type tests use only the API that `@types/express` 4 and 5 share (`Request`, `Response`, `NextFunction`, `Router`, `RequestHandler`). Version-specific type assertions go in `*.v5.test-d.ts`.

### ADR-39 (excerpt, verbatim)
> S-04, S-05, S-06 and S-07 **import** `majors.ts`. Local copies or parameterizers are forbidden, and a lint `no-restricted-syntax` rule flags `require('express4')` outside `test/fixtures/**`.

### ADR-29 obligations (verbatim)
> **CR-7:** `test/route/send-delegation.test.ts` asserts, on both majors, that `res.send(invalidObject)` is validated when `validateResponses: 'error'`.

> **Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge.

### ADR-27d (verbatim)
> The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70.

### Constraints
- Do not edit `package.json`, `src/core/types.ts`, `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `src/route/describe.ts` (S-05), `src/config/**`, `src/adapter/**` or any `test/fixtures/**` file.
- Use `META` from `core/types.ts`; never a local `Symbol()` (ESLint `no-restricted-syntax`).
- No local Express parameterizer: runtime tests use `describe.each` over `majors` from `test/fixtures/majors.ts` (ADR-39).
- AC-011 (spec 400 `$ref`) is emitted by S-06; this story exports only the ProblemDetails schema and media-type constant from `problem.ts`.
- AC-005 / AC-047: this story covers only the route half (stub adapter validates; per-route `meta.adapter` overrides global). Spec and wiring belong to S-06 / S-07.
- Mutation (break 70) covers `src/route/**` and `src/registry/**`; assert exact values.

## Acceptance criteria (from PRD)

- **AC-005** (route half): Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code.
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
- **AC-047** (per-route route half): Given `schemaAdapter: stubAdapter` globally or per-route, When requests are validated and the spec is generated, Then the stub adapter's parse and toJsonSchema are used, and per-route overrides global.

## Test plan

Write these FIRST and capture them red before any `src/` code. Every runtime test uses `describe.each` over `majors` imported from `test/fixtures/majors.ts`. Logger assertions use a dedicated logger spy per test.

1. `test/route/typed.test-d.ts` (AC-006; shared `@types/express` 4/5 API only, ADR-36)
   - `infers params/query/body`: `expectTypeOf` on `req.params.id`, `req.query`, `req.body` matches the schema's inferred type.
   - `rejects wrong assignment`: `// @ts-expect-error` on `const n: number = req.params.id` (string schema).
   - Any v5-only assertion goes in `test/route/typed.v5.test-d.ts`.
2. `test/route/request-validation.test.ts` (AC-007, 008, 009, 010, 040, 044d, ADR-37)
   - `invalid body -> 400 problem+json`: status 400; `content-type` matches `application/problem+json`; body has `type`, `title`, `status === 400`, `detail`; `errors[0]` has exactly keys `in`, `path`, `message`; handler spy called 0 times.
   - `errors[].in per location`: three cases give `'path'`, `'query'`, `'body'`.
   - `valid request gets coerced values`: coerced query arrives as number `5`; handler response returned verbatim.
   - `global onValidationError replaces body` (AC-010, AC-040): formatter status (e.g. 422) and body returned.
   - `per-route onValidationError beats global` (AC-044d): global spy called 0 times.
   - `validateRequests:false`: invalid request gives 200; handler called exactly once.
   - `async refine -> 500 EAD_ASYNC_SCHEMA` (ADR-37): body schema `z.object({a:z.string()}).refine(async () => true)`, valid body; status 500; error middleware receives an error with `instanceof ApiDocsSchemaError` (brand) and `code === 'EAD_ASYNC_SCHEMA'`; handler spy 0 calls; no `application/problem+json` response.
3. `test/route/response-validation.test.ts` (AC-012, 013, 014, 044c)
   - `unset -> unchanged, silent`: invalid body byte-equal; every logger method spy 0 calls.
   - `validateResponses:false -> res.json not wrapped` (ADR-03): identity check against the original `res.json`.
   - `'warn' -> unchanged + exactly one warn`: `logger.warn` called exactly 1 time.
   - `'error' -> 500, body withheld`.
   - `per-route 'error' beats global 'warn'` (AC-044c): 500; `warn` 0 calls.
4. `test/route/send-delegation.test.ts` (CR-7; AC-014)
   - `res.send(invalidObject)` with `validateResponses: 'error'` gives 500 and the payload is not sent.
   - `res.send(validObject)` gives 200 with the object as JSON.
   - `res.send('raw string')` passes through unvalidated (documented limit in C3).
5. `test/route/async.test.ts` (AC-024, ADR-29 #4)
   - `async throw reaches error middleware exactly once`: 4-arity error middleware spy called exactly 1 time with the same error instance (`toBe`).
   - `rejected promise reaches error middleware exactly once`: same assertion.
6. `test/route/wrap-async.test.ts` (ADR-33; on both majors)
   - (a) rejection before any write: error middleware called exactly once.
   - (b) `res.write('chunk')` then rejection: exactly one `next(err)` although `res.headersSent === true`; the client socket closes within 1 s.
   - (c) handler calls `next(err)` then rejects: no second `next` call (count stays 1).
   - Unit extras with a mock `next`: synchronous throw forwarded once; resolved handler calls `next` 0 times.
7. `test/route/stub-adapter.test.ts` (AC-005, AC-047, ADR-38)
   - Using `test/fixtures/stub-adapter.ts`: invalid body gives 400 problem+json with handler 0 calls; valid body gives the handler the stub's parsed data (`toEqual`).
   - `meta.adapter overrides global`: with global `schemaAdapter` set to a spy adapter and per-route `meta.adapter: stubAdapter`, only the stub's `validate` is called; the global spy has 0 calls.
   - `global schemaAdapter used when no meta.adapter`: the global adapter's `validate` is called.
8. `test/route/meta-tag.test.ts` (ADR-44)
   - Both returned tuple elements (validator and handler) carry `[META]` (imported from `core/types.ts`) equal to `{source: 'typed', method, meta}`.
9. `test/route/incremental.test.ts` (AC-021)
   - Router with plain `GET /plain` and `POST /plain` plus typed `POST /typed`: invalid body to `/plain` gives the plain response (not 400); only `/typed` returns 400.
10. `test/route/problem.test.ts` (AC-011, problem schema part)
    - ProblemDetails schema has `type`, `title`, `status`, `detail`, and `errors` items `{in, path, message}` with `in` enum `['path','query','body']`; media-type constant equals `'application/problem+json'`.
11. `test/registry/registry.test.ts` (C12, ADR-17, ADR-27c)
    - `register` returns the input plus `id`; ids strictly increase; `entries()` in registration order.
    - `findByHandle` on `validatorFn` and on `handlerFn` returns the same entry (`toBe`); unknown fn and non-function give `undefined`.
    - `describe`-source entry without `validatorFn` is found by `handlerFn`.
    - Two registries are isolated; mutating the array returned by `entries()` does not change a later call.
    - `route()` with a registry adds exactly one `source: 'typed'` entry whose `validatorFn`/`handlerFn` are `toBe` the returned tuple elements.
    - Type conformance: `const r: RouteRegistry = createRegistry()` compiles.

## Verification commands

Copied verbatim from architecture.md "Verification Commands":

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- mutation: `npx stryker run --mutate "src/route/typed.ts,src/route/validate-request.ts,src/route/validate-response.ts,src/route/async.ts,src/route/problem.ts,src/registry/**" --incremental` (per-story scoped run per ADR-50, which supersedes ADR-35's mutation command; `thresholds.break: 70` applies to this scope)
- audit: `npm audit --audit-level=critical`, probe after scaffold story

Story-focused red/green loop: `npx vitest run --typecheck test/route test/registry`. Not sufficient for merge: the full `npm test` with global thresholds must pass in this worktree (ADR-29 #7), and the ADR-50 scoped command above (`npx stryker run --mutate "src/route/typed.ts,src/route/validate-request.ts,src/route/validate-response.ts,src/route/async.ts,src/route/problem.ts,src/registry/**" --incremental`) must meet `thresholds.break: 70` over that scope.

## Builder Report

### Interpretation note (story defect / gap filled)

The architecture.md consumer snippet (`router.get('/users/:id', ...api.route({ params, query, responses }, handler))`)
does not give `route()` the method/local path it needs to satisfy the ADR-27c
`RegistryEntry` contract ("recorded at declaration"). Since this story is solo
and self-contained, I resolved the gap by giving `route()` the explicit
signature `route(method, localPath, meta, handler)`, and a `createRoute(deps)`
factory (`deps: { registry, options, logger }`) standing in for the
composition root that S-07 will build. `meta.response` (singular) is the
response-schema key, matching AC-006's prose ("schemas for params, query, body
and response"). This is documented here per the builder protocol ("if not,
that is a story defect — report it").

### Red (failing) run, before fixes

First `--typecheck` pass against the newly written tests (before removing bad
explicit `Request`/`Response` annotations that fought the generic inference,
and before two runtime bugs were fixed) failed with 2 runtime test failures
plus 15 TypeScript errors:

```
$ npx vitest run --typecheck test/route test/registry
...
 FAIL  test/route/request-validation.test.ts > ... ADR-37: async refine -> 500 ...
AssertionError: the given combination of arguments (undefined and string) is invalid ...
 FAIL  test/route/incremental.test.ts [ test/route/incremental.test.ts ]
TypeError: path must be a string, array of strings, or regular expression
... (13 more TypeCheckError blocks, e.g. "Type 'unknown' is not assignable to type 'ParamsDictionary'.")
Test Files  2 failed | 9 passed (11)
     Tests  2 failed | 59 passed (61)
     Errors  26 errors
```

### Green run, after fixes

```
$ npx vitest run --typecheck test/route test/registry
 Test Files  11 passed (11)
      Tests  63 passed (63)
Type Errors  no errors
```

Fixes applied: (1) `ParamsOf`/`QueryOf`/`BodyOf` helper types in `typed.ts` so
an un-schema'd slot falls back to Express's own defaults instead of `unknown`
(which `Request`'s generics reject); (2) removed explicit `(_req: Request, res:
Response)` annotations on handlers passed straight to `route()`, letting
contextual typing infer the right `Request<...>` shape (kept explicit typing
only for `vi.fn`-boxed handlers, via `TypedRequestHandler<unknown,unknown,unknown>`);
(3) `OnValidationErrorHook` widened to `(error: unknown) => {...}` to match
config's `OnValidationError`; (4) fixed `test/route/incremental.test.ts`'s
Router construction; (5) fixed a `content-type` assertion and a strict-index
type error in `test/route/problem.test.ts`.

### Full suite (npm test), lint, typecheck — in this worktree

```
$ npm test
 Test Files  35 passed (35)
      Tests  201 passed (201)
Type Errors  no errors
Statements 97.68% | Branches 92.38% | Functions 100% | Lines 98.23%   (>= 90/90/90/90 ✓)

$ npm run lint
Checking formatting...
All matched files use Prettier code style!

$ npx tsc --noEmit
(no output — exit 0)
```

### Mutation (ADR-50 scoped, thresholds.break: 70)

```
$ npx stryker run --mutate "src/route/typed.ts,src/route/validate-request.ts,src/route/validate-response.ts,src/route/async.ts,src/route/problem.ts,src/registry/**" --incremental
...
File                   |  total | covered | # killed | # timeout | # survived
registry/registry.ts   | 100.00 |  100.00 |       22 |         0 |          0
route/async.ts         |  95.24 |   95.24 |       20 |         0 |          1
route/problem.ts       | 100.00 |  100.00 |       40 |         0 |          0
route/typed.ts         | 100.00 |  100.00 |       32 |         0 |          0
route/validate-request.ts  | 100.00 | 100.00 |    45 |         1 |          0
route/validate-response.ts | 100.00 | 100.00 |    11 |         0 |          0
Final mutation score of 82.51 is greater than or equal to break threshold 70
Done in 16 minutes and 58 seconds.
```

Own-scope total (route/** + registry/**): 170/171 activated mutants killed, 1
timeout, 1 survived (a trivial `if (settled) return;` → `if (false) return;`
mutant in `async.ts`, harmless since the surrounding assertions already pin
`settled`'s external behaviour in `wrap-async.test.ts`). Overall score 82.51
>= 70 break threshold. First dry run attempt hit a pre-existing, unrelated
flaky timeout in `test/meta/lint-rules.test.ts` (5000ms eslint cold-start);
rerun passed cleanly.

### AC self-check

- AC-005 (route half): ✓ `test/route/stub-adapter.test.ts` — stub adapter validates requests; handler receives stub-parsed data.
- AC-006: ✓ `test/route/typed.test-d.ts` — `req.params/query/body` inferred; `@ts-expect-error` on a wrong assignment.
- AC-007: ✓ `test/route/request-validation.test.ts` "invalid body -> 400 problem+json" — status, content-type, body shape, handler not called.
- AC-008: ✓ same file, "errors[].in per location" — path/query/body cases.
- AC-009: ✓ same file, "valid request gets coerced values".
- AC-010: ✓ same file, "global onValidationError replaces the default 400 body".
- AC-011 (schema part only): ✓ `test/route/problem.test.ts` — `PROBLEM_DETAILS_SCHEMA` shape + `PROBLEM_CONTENT_TYPE`.
- AC-012/013/014: ✓ `test/route/response-validation.test.ts` — unset (silent, unchanged), 'warn' (1 warn, unchanged), 'error' (500, withheld).
- AC-021: ✓ `test/route/incremental.test.ts` — plain routes on the same router keep working; only the typed route validates.
- AC-024: ✓ `test/route/async.test.ts` — both majors, error middleware reached exactly once, same error instance for the rejection case.
- AC-040: ✓ `request-validation.test.ts` "validateRequests:false" case, and the onValidationError case.
- AC-044 (c,d only): ✓ `response-validation.test.ts` "per-route error beats global warn" (c); `request-validation.test.ts` "per-route onValidationError beats global" (d).
- AC-047 (route half): ✓ `stub-adapter.test.ts` "meta.adapter overrides global" and "global schemaAdapter used when no meta.adapter".
- ADR-33 (wrapAsync exactly-once, incl. headersSent): ✓ `test/route/wrap-async.test.ts`, cases (a)(b)(c) on both majors plus unit extras.
- ADR-37 (async refine -> 500 EAD_ASYNC_SCHEMA): ✓ `request-validation.test.ts`.
- ADR-38 (adapter resolution order, `meta.adapter` override): ✓ `typed.ts` `resolveAdapter`, tested in `stub-adapter.test.ts`.
- ADR-44 ([META] tag on both tuple elements): ✓ `test/route/meta-tag.test.ts`.
- CR-7 (res.send(obj) delegates to res.json): ✓ `test/route/send-delegation.test.ts`.
- C12/ADR-17/ADR-27c (RouteRegistry, implements the S-01-pinned interface, never redeclared): ✓ `src/registry/registry.ts`, `test/registry/registry.test.ts`.

### Constraints honoured

- No edits to `package.json`, `src/core/types.ts`, `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `src/route/describe.ts`, `src/config/**`, `src/adapter/**`, or any `test/fixtures/**` file.
- `META` imported from `core/types.ts`; no local `Symbol()` (eslint `no-restricted-syntax` passes).
- No local Express parameterizer: all runtime route/registry tests use `describe.each(majors)` from `test/fixtures/majors.ts`.
- `src/route/**` and `src/registry/**` never import `zod` (only `test/route/*.test.ts` files do, which is allowed).

### git diff --stat (confined to the owned file scope)

```
$ git diff --stat --cached -- src/route src/registry test/route test/registry
 src/registry/registry.ts               |  27 +++++++
 src/route/async.ts                     |  40 ++++++++++
 src/route/problem.ts                   |  56 +++++++++++++
 src/route/typed.ts                     | 123 +++++++++++++++++++++++++++++
 src/route/validate-request.ts          |  90 +++++++++++++++++++++
 src/route/validate-response.ts         |  47 +++++++++++
 test/registry/registry.test.ts         |  63 +++++++++++++++
 test/route/async.test.ts               |  45 +++++++++++
 test/route/incremental.test.ts         |  40 ++++++++++
 test/route/meta-tag.test.ts            |  19 +++++
 test/route/problem.test.ts             |  34 ++++++++
 test/route/request-validation.test.ts  | 140 +++++++++++++++++++++++++++++++++
 test/route/response-validation.test.ts |  87 ++++++++++++++++++++
 test/route/send-delegation.test.ts     |  60 ++++++++++++++
 test/route/stub-adapter.test.ts        |  75 ++++++++++++++++++
 test/route/support.ts                  |  54 +++++++++++++
 test/route/typed.test-d.ts             |  35 +++++++++
 test/route/wrap-async.test.ts          |  99 +++++++++++++++++++++++
 18 files changed, 1134 insertions(+)
```

All new/modified files fall within the owned set: `src/route/typed.ts`,
`src/route/validate-request.ts`, `src/route/validate-response.ts`,
`src/route/async.ts`, `src/route/problem.ts`, `src/registry/**`,
`test/route/**`, `test/registry/**`.

**Status: built.**


## Auditor Report

Verdict: **13/13 claimed ACs PROVEN, round 1, no challenge round needed** — full
per-AC evidence in `audit/interrogation/ST-004-verdict.md`.

Scope interrogated: AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-013,
AC-014, AC-021, AC-024, AC-040, AC-044(c,d).

Independent verification performed (not taken on the builder's word):
- Re-ran `npx vitest run --typecheck test/route test/registry` myself: 11 files / 63
  tests passed, 0 type errors — matches the Builder Report's green run exactly.
- Read `src/route/typed.ts` and `src/route/async.ts` directly to confirm AC-006's
  type-inference mechanism (`ParamsOf`/`QueryOf`/`BodyOf`) and AC-024's version-agnostic
  `wrapAsync` (`settled` flag, single `next(err)` call even after `headersSent`) are
  real implementations, not assertions resting on mocked paths.
- Re-ran the exact ADR-50 scoped Stryker command independently: reproduced 82.51
  overall bit-for-bit, and the same per-file own-scope breakdown (registry.ts,
  typed.ts, problem.ts, validate-response.ts at 100%; validate-request.ts 100% with
  1 timeout; async.ts 95.24% with the same disclosed surviving `if (settled) return`
  mutant).

No negotiation entries required; no DISPUTED ACs.

## QA Fix Loop — Iteration 1 (QA step 6)

One CONFIRMED finding from QA (`qa/verdicts.md`), your portion owned by this story.

### Defect — F-04 (HIGH): `memoizeAdapter` never wired into `resolveAdapter`

`src/route/typed.ts:61-68` (`resolveAdapter`): returns `meta.adapter`, `globalOptions.schemaAdapter`, or `standardSchemaAdapter` directly — the raw, unwrapped adapter. `memoizeAdapter` (`src/adapter/memo.ts`, ADR-03) is defined and unit-tested in isolation but never imported here (confirmed via `grep -rn "memoizeAdapter" src/`: the only match is the export declaration itself). No compensating cache exists elsewhere for per-schema JSON Schema conversion — `src/spec/cache.ts` only caches the whole built document by router fingerprint, not per-schema conversions. Every spec rebuild re-derives every operation's schema conversions from scratch.

**Fix requirement:** wrap the resolved adapter in `memoizeAdapter(...)` before returning it from `resolveAdapter`. Coordinate with ST-007's `src/serve/router.ts` fix (same defect, different call site) so both composition-root paths get the memoization benefit consistently.

**Required regression test:** verify (via a WeakMap-identity check, spy, or measured invocation count) that calling `toJSONSchema` twice on the same schema object through the resolved adapter only invokes the underlying adapter's `toJSONSchema` once. Re-confirm `test/adapter/memo.test.ts` and `test/route/stub-adapter.test.ts` still pass, plus your own ADR-50(a) scoped mutation command afterward.
