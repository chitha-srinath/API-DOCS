---
id: ST-005
title: "S-05 Introspection: recorder with installRecorder, the auto-record entry, v4 and v5 walkers, paths, describe(). Gated by G-S05"
wave: 4
status: ready
attempts: 0
ac_ids:
  - AC-022
  - AC-023
  - AC-030
  - AC-031
  - AC-032
  - AC-033
  - AC-034
depends_on:
  - ST-001
  - ST-004
file_scope:
  owns:
    - src/route/describe.ts
    - src/introspect/**
    - src/auto-record.ts
    - test/introspect/**
    - test/describe/**
    - test/fixtures/**
  creates:
    - src/introspect/
    - test/introspect/
    - test/describe/
    - test/fixtures/
---

# ST-005 (epic S-05): Introspection, recorder with `installRecorder`, the auto-record entry, v4 and v5 walkers, paths, `describe()`

> Id note: the epic calls this story `S-05`. The frontmatter schema requires `^ST-[0-9]{3}$`,
> so it is `ST-005` here. `ST-001` is epic S-01 and `ST-004` is epic S-04.
> Dependency: **S-01 and S-04** (ADR-27b). This supersedes "S-01 and C0".
> Risk: **high**. From the epic: "R-1 and R-8: Express private internals; patches the `use` prototype at import; APM ordering; module identity across copies; gate G-S05".
> Size: 8 source files (6 in `src/introspect/`, plus `src/route/describe.ts` and `src/auto-record.ts`). The epic accepts this: "they are one recorder/walker seam, and the extra 2 files are thin."

## Context

Greenfield repo (context pack: no re-crawl). There is no existing code to quote. The excerpts below
are verbatim from `architecture.md` and `epic.md`.

### Gate G-S05: FIRST TASK (blocking)

From architecture.md, "Introspection spike — gate G-S05":

> **Gate.** Before S-05 is committed, `test/introspect/spike.contract.test.ts` must pass on `express@5.2.1` and `express4@npm:express@4.22.3`. It re-encodes the S-4b fixtures below: a nested Router, a mounted sub-app, a wrapped handler and a plain route. S-05 owns the test, and S-05's first task is to run it. **Status as of 2026-09-27: PASS, via the throwaway spike below** (run outside the repo, in `%TEMP%\aidd-spike`).

From epic.md, Wave 4:

> Its first task is gate G-S05, `test/introspect/spike.contract.test.ts` on `express@5.2.1` and `express4@4.22.3`, with the fixtures calling `installRecorder(require('express4'))` explicitly (ADR-23).

Order of work: (1) write `test/fixtures/majors.ts`, `test/fixtures/logger.ts`, `test/fixtures/apps.ts` and
`test/introspect/spike.contract.test.ts`; (2) run the contract test and record RED; (3) implement the recorder
and walkers until it is GREEN on every deduped major; (4) only then commit the auto-detect code and continue
with the other tests.

### Spike evidence (verbatim from architecture.md)

```
$ cd "$TEMP/aidd-spike" && npm init -y && npm i express5@npm:express@5.2.1 express4@npm:express@4.22.3   exit 0
found 0 vulnerabilities
```

S-1: static walk, tag on handler (`spike.cjs`). Fixtures: `app.use('/api', r)` with `r.get('/users/:id')`; `app.use('/v1', subApp)`; `app.get('/w', wrap(tagged))`, where `wrap = fn => (req,res,next) => fn(req,res,next)`. Exit code 0.
```
== express4 root=_router
{"name":"router",...,"regexp":"/^\\/api\\/?(?=\\/|$)/i","sub":"router"}      <- v4 prefix recoverable
{"name":"mounted_app",...,"regexp":"/^\\/v1\\/?(?=\\/|$)/i"}                   <- sub-app opaque
{"name":"bound dispatch",...,"route":"/w","metaDirect":[null]}                 <- tag LOST by wrapper
== express5 root=router
{"name":"router","keys":["handle","keys","name","params","path","slash","matchers","route"],"sub":"router"}  <- NO prefix string
{"name":"mounted_app",...}                                                      <- sub-app opaque
{"name":"handle",...,"route":"/w","metaDirect":[null]}                          <- tag LOST
```
Verdict for S-1: v4 nested PASS. v5 nested FAIL. Sub-app FAIL on both majors. Wrapper FAIL on both majors. **ADR-07 as written does not hold.**

S-2: Express 5 matcher and sub-app reachability (`spike2.cjs`). Exit code 0.
```
express5 {"matcherProps":["length","name","prototype"],"matcherSrc":"function match(input) {\n        const m = regexp.exec(input)","probeApi":true,"subMountpath":"/v1","subParentIsApp":true,"mountedAppHandleProps":["length","name","prototype"]}
```
The matcher is an opaque closure. The sub-app knows its own `mountpath`, but the parent cannot enumerate it.

S-3: hybrid registry plus a recorder patched on the wrong prototype level (`spike3.cjs`). Exit code 0, result FAIL:
```
== express5
GET ?/users/:id meta=nested
registry-missing-from-walk: subapp,wrapped
```
Cause: an Express 5 `Router()` is a function whose prototype is a Router *instance*, so `use` lives two levels up (`sameProto false hasOwnUse false`). Hence ADR-18 says "the prototype that owns `use`".

S-4a: first run of `spike4.cjs`. Exit code 1:
```
Error: 'app.router' is deprecated!  at app.get (express4/lib/application.js:131)
```
Reading `app.router` on Express 4 throws, so the sniff must use keys (ADR-18).

S-4b: `spike4.cjs` with the ADR-17 hybrid plus the ADR-18 recorder (owner-prototype `use` and `application.use`). Exit code 0, result **PASS**. This is the expected output the contract test re-encodes:
```
== express4
GET /api/users/:id meta=nested
GET /v1/items/:id meta=subapp
GET /w meta=wrapped
GET /plain meta=none
registry-missing-from-walk: none
== express5
GET /api/users/:id meta=nested
GET /v1/items/:id meta=subapp
GET /w meta=wrapped
GET /plain meta=none
registry-missing-from-walk: none
```
Remaining cases that the ADRs handle rather than solve:

- If a user wraps **both** our validator and the handler, identity matching fails. The route is emitted at its local path with a `warn` (ADR-17/19).
- Express 5 mounts made before the package is imported fall back the same way (ADR-18).

### Components

- **C4** `src/route/describe.ts`: "`describe(meta)` returns a pass-through middleware tagged with `[META]`, `source: 'describe'`. It never validates." Per ADR-17, "`describe.ts` (S-05) only calls its `register()` API" on the S-04 `RouteRegistry`.
- **C5** `src/introspect/{recorder.ts, auto-record.ts, index.ts, express4.ts, express5.ts, paths.ts}`: "`introspect(app, log): DetectedOperation[]`. [...] Each layer is handled in its own try/catch, and an unknown shape is skipped with a debug log. The v4 mount prefix is recovered from `layer.regexp`; the v5 prefix comes from the layer matcher or path. `paths.ts` handles path conversion: `:id` becomes `{id}`, `/*rest` becomes `{rest}`, and optional segments expand into two paths. RegExp routes and unnamed `*` are skipped with exactly one debug line each. `[META]` tags are read here."
  - **VOID (ADR-27a):** the C5 phrase "falling back to the other" does not apply. Use the pinned key-only sniff below. Per ADR-19, unknown shapes are logged at `warn`, not `debug`.
- **C0** (S-01, read-only): "`DetectedOperation {method, path, pathParams[], source: 'typed'|'describe'|'plain', meta?}`, `Logger`, and `META: unique symbol`." ADR-20 makes all identities `Symbol.for` (below).

### Pinned seams (verbatim, ADR-27)

(a) Version sniff (key-only, never throws, CR-4). Implement in `src/introspect/index.ts`:

```ts
const isV4 = Object.prototype.hasOwnProperty.call(app, '_router') || typeof app.lazyrouter === 'function';
const root = isV4 ? (app.lazyrouter?.(), app._router) : app.router;
```

(c) `RouteRegistry` contract in `src/core/types.ts` (owner: S-01; implementation: S-04 `src/registry/registry.ts`; consumers: S-05, S-06):

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

### Binding decisions (verbatim excerpts)

- **ADR-17:** "A per-instance `RouteRegistry` records typed and `describe()` routes at declaration, as `{method, localPath, meta, validatorFn, handlerFn}`. [...] The stack walk (C5) does exactly two things: (a) attach mount prefixes by matching layer handles by identity against the registered `validatorFn` **or** `handlerFn`; (b) find plain routes. A registry entry that the walk cannot locate is still emitted with its local path, plus one `warn` (ADR-19). [...] ADR-07's `[META]` tag stays only as a secondary match key." Use `RouteRegistry.findByHandle()` for the identity match.
- **ADR-18:** "when `express-api-docs` is imported, `src/introspect/recorder.ts` (S-05) wraps the `use` method on the prototype that **owns** it. Because of Express 5's two-level router prototype, this is found by walking the prototype chain. It also wraps `express.application.use`. The wrappers call the original first, then only **annotate** the newly pushed layers with `[MOUNT]=path` and `[CHILD]=subApp`. They never change dispatch. [...] Express 4 falls back to `layer.regexp` for mounts made before the import. Express 5 mounts made before the import get the local path and a `warn`. [...] **On Express 4, reading `app.router` THROWS** (spike S-4a), so the sniff must never read it."
- **ADR-19:** "These are logged at **`warn`** through the configured logger, once per layer or route per walk: a registry entry not found in the stack, an unrecognised layer shape, a mount whose prefix cannot be recovered, a `mounted_app` without `[CHILD]`, and a layer skipped because it threw. Only the AC-034 skips stay at `debug`: `RegExp` paths and unnamed `*` wildcards."
- **ADR-20:** "There are exactly four, defined in `src/core/types.ts` (S-01): `META = Symbol.for('express-api-docs.meta')`, `MOUNT = Symbol.for('express-api-docs.mount')`, `CHILD = Symbol.for('express-api-docs.child')` and `RECORDER = Symbol.for('express-api-docs.recorder')` (the idempotency guard stored on each patched prototype). Local `Symbol()` is **banned** for any value that crosses module boundaries." Import them from `src/core/types.ts`; never declare your own.
- **ADR-23:** "a public `installRecorder(expressModule)`. [...] It is idempotent through `RECORDER` on the owner prototypes. **Default install:** `src/introspect/auto-record.ts` resolves `express` from the package's own location (`createRequire(import.meta.url)` in ESM, `require` in CJS; tsup shims) and calls `installRecorder()` on it. A resolution failure is swallowed with one `warn`. [...] **Mismatch warning:** at the first walk, if the app's router owner prototype lacks `RECORDER`, the package emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`. The message names the fix (`installRecorder(<your express>)`). **Repo tests:** fixtures call `installRecorder(require('express4'))` explicitly. [...] The root `express` copy exercises the default auto path. `test/introspect/recorder-mismatch.test.ts` builds an app from a copy that has *not* been installed (a fresh `express4` module instance, isolated with `vi.resetModules`) and asserts the single warn and local-path fallback."
- **ADR-24:** "the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. `src/index.ts` begins with a bare `import './auto-record'`." `src/auto-record.ts` (owned here) is the thin side-effect entry that imports `./introspect/auto-record`. `src/index.ts`, `src/manual.ts` (the opt-out) and the tsup entry list are NOT owned here.
- **ADR-25:** "`test/fixtures/majors.ts` (S-05) reads the `version` from `express/package.json` and `express4/package.json`, **dedupes by major**, and exports `majors: Array<{ major: 4\|5, express }>`. [...] Express 5-only cases (the `/*rest` named wildcard in AC-034, `{/:id}` optionals, the `app.router` sniff) use `it.skipIf(major !== 5)`. Express 4-only cases (`*`, `:id?`) use `skipIf(major !== 4)`." The `peer-floor` CI job runs `test/introspect/**` on `express@4.21.0` and `express@5.0.0` + `router@2.0.0`, so the walkers must not assume newer layer shapes.
- **ADR-29:**
  - "**CR-3:** `test/introspect/apm-order.test.ts` applies a third-party-style wrapper (`proto.use = wrap(proto.use)` plus a layer-handle wrapper) **before and after** `installRecorder`. It asserts that prefixes survive in both orders [...]. If "after" fails, it must emit `warn` `EAD_LAYER_UNRECOGNISED`, not fail silently."
  - "**CR-8:** if `req.app.parent` exists, the walk emits one `warn` `EAD_MOUNTED_IN_SUBAPP` and walks from the topmost ancestor (`while (app.parent) app = app.parent`)."
  - "**F-6:** the recorder computes "new layers" from `stack.length` **captured before** calling the original `use`. This applies in both wrappers". **Rule for this story:** in both the router-prototype `use` wrapper and the `application.use` wrapper, read `const before = stack.length` first, then call the original, then annotate only `stack.slice(before)`.
  - "**Test-strategy #9:** each fixture gets a dedicated logger spy, and warn assertions filter by the stable message `code` (`EAD_*`)."
  - "**Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge."
- **ADR-27d:** Stryker `mutate` covers `src/introspect/**` and `src/route/**` (among others). `thresholds.break` stays at 70.
- Detection never throws (R-1: "degradation to 'undocumented' instead of an exception").

### Boundaries

- Do NOT edit `package.json`, `tsup.config.ts`, `eslint.config.js`, `vitest.config.ts`, `stryker.config.mjs`, `.github/**` or `src/core/types.ts` (S-01); `src/registry/**` or the other five `src/route/*` files (S-04); `src/spec/**` (S-06); `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `test/entries/**` (S-07); `README.md` (S-08; it documents the CR-3 result). Need something there: record it in the Builder Report.
- The spec side of AC-023/030/031/033/034 (operationId, tag `api`, `exclude` glob, dedupe, self-exclusion, byte identity) belongs to S-06. This story delivers the walk side: correct, deterministic `DetectedOperation[]` with `source` and `meta`, so S-06 can dedupe and exclude.
- The dual-load and bundle tests (ADR-20, ADR-24) belong to S-07; this story must make them passable by using only `Symbol.for` identities and the `src/auto-record.ts` entry.

## Acceptance criteria (from PRD)

- **AC-022** Given a plain handler wrapped with the `describe()` middleware, When the spec is generated, Then the route appears with its declared metadata, and invalid requests to it are not rejected (docs only).
- **AC-023** Given plain routes registered without the typed helper or `describe()`, on Express 4 and on Express 5 (tested separately), including a nested router mounted with `app.use('/api', router)` that has `router.get('/users/:id')` and `router.post('/users/:id')`, When the spec is generated, Then auto-detection walks the router stack and the spec contains path `/api/users/{id}` with exactly one `get` and one `post` operation. Each has an `operationId`, a required `path` parameter `id` with schema `type: string`, a generic `200` response, and the tag `api`.
- **AC-030** (walk side) Given `autoDetect: false`, When the spec is generated, Then no plain route appears in it. Given `autoDetect` is left at its default and `exclude: ['/internal/**']`, When the spec is generated, Then plain routes under `/internal/` are absent and other plain routes are present.
- **AC-031** (identity match) Given the same method and path registered both as a typed route (or with `describe()`) and as a plain route that auto-detection would find, When the spec is generated, Then exactly one operation exists for that method and path, and it carries the typed or `describe()` metadata.
- **AC-032** (walk) Given the spec middleware is mounted before a plain route is added, When the first spec request arrives after that route was added, Then the route appears in the spec.
- **AC-033** (detection side) Given auto-detection is enabled, When the spec is generated, Then the package's own spec endpoint and docs endpoint paths do not appear in it.
- **AC-034** Given plain routes registered with a `RegExp` path, an Express 4 `*` wildcard and an Express 5 named wildcard `/*rest`, When the spec is generated twice, Then generation does not throw; the RegExp and unnamed-wildcard routes are skipped with one debug log line each; the named wildcard maps to `{rest}`; and both generated specs are byte-identical.

## Test plan

Write tests FIRST and capture the failing run before any implementation. Every suite iterates
`majors` from `test/fixtures/majors.ts` (`describe.each(majors)`), deduped by detected major (ADR-25).
Major-specific cases use `it.skipIf(major !== 5)` / `it.skipIf(major !== 4)`. Every fixture gets its own
logger spy from `test/fixtures/logger.ts`; warn assertions filter by `EAD_*` code (ADR-29 #9).

0. **Fixtures.**
   - `test/fixtures/majors.ts`: reads `version` from `express/package.json` and `express4/package.json`, dedupes by major, exports `majors: Array<{ major: 4|5, express }>`. For the `express4` alias it calls `installRecorder(require('express4'))` explicitly (ADR-23); the root `express` relies on the default auto path.
   - `test/fixtures/logger.ts`: `makeLoggerSpy()` returning `{ log, warns(code?), debugs() }`, backed by `vi.fn()`.
   - `test/fixtures/apps.ts`: `makeApp({ major, express })` building the S-4b set: `app.use('/api', r)` with `r.get('/users/:id')` and `r.post('/users/:id')`; `app.use('/v1', subApp)` with `subApp.get('/items/:id')`; `app.get('/w', wrap(taggedHandler))`; `app.get('/plain')`.
1. **G-S05: `test/introspect/spike.contract.test.ts` (first, blocking).** For each major, `introspect(app, log)` returns (sorted) `GET /api/users/{id}` meta=nested, `GET /v1/items/{id}` meta=subapp, `GET /w` meta=wrapped, `GET /plain` with `source: 'plain'` and no meta. No registry entry is missing from the walk (zero `warn` calls). The walk does not throw.
2. `test/introspect/walk.test.ts`
   - `/api/users/{id}` has exactly one `get` and one `post`, `pathParams` equal to `['id']` (AC-023).
   - a plain route added after the spec middleware is mounted is found on the next walk (AC-032).
   - `autoDetect: false` yields no `source: 'plain'` ops; registry routes are still present (AC-030 walk side).
   - a typed or `describe()` route and the same plain method/path: the detected op carries `source` typed/describe and its meta, via `findByHandle` identity match (AC-031 walk side).
   - the package's own spec and docs paths are omitted from the detected set (AC-033 detection side).
3. `test/introspect/sniff.test.ts` (ADR-27a): on v4 (`skipIf(major !== 4)`), define an `app.router` getter that throws; `introspect` succeeds and the getter is never called. On v5, the root is `app.router`.
4. `test/introspect/paths.test.ts` (AC-034): `:id` becomes `{id}`; `/*rest` becomes `{rest}` (v5 only); `{/:id}` optional expands into two paths (v5 only); `:id?` expands into two paths (v4 only); unnamed `*` (v4 only) and a RegExp path are each skipped with exactly one `debug` call and no throw; two walks give deep-equal output.
5. `test/introspect/warn.test.ts` (ADR-19): exactly one `warn` per case, filtered by `EAD_*` code: registry entry not in the stack (validator and handler both wrapped, emitted at local path), unrecognised layer shape, unrecoverable mount prefix, `mounted_app` without `[CHILD]` (v5 mount made before install), and a layer whose inspection throws.
6. `test/introspect/recorder.test.ts` (ADR-18, ADR-23, F-6): `installRecorder` called twice wraps `use` once (`RECORDER` guard on the owner prototype, found by walking the prototype chain on v5); only layers from `stack.slice(before)` get `[MOUNT]`/`[CHILD]`, where `before` is captured before calling the original (verified by a `use` that pushes several layers); dispatch is unchanged (a supertest request still reaches the handler); the identities equal `Symbol.for('express-api-docs.*')`.
7. `test/introspect/recorder-mismatch.test.ts` (ADR-23): `vi.resetModules`, build an app from a fresh, un-installed `express4` instance; the first walk emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED` whose message contains `installRecorder(`; routes fall back to local paths; a second walk does not warn again.
8. `test/introspect/auto-record.test.ts` (ADR-23, ADR-24): importing `src/auto-record.ts` installs the recorder on the resolved root `express`; a simulated resolution failure is swallowed with one `warn`.
9. `test/introspect/apm-order.test.ts` (CR-3): a third-party-style wrapper (`proto.use = wrap(proto.use)` plus a layer-handle wrapper) applied before and after `installRecorder`. Prefixes survive in both orders, or, if "after" cannot recover them, exactly one `warn` `EAD_LAYER_UNRECOGNISED` is emitted (never silent).
10. `test/introspect/subapp-parent.test.ts` (CR-8): calling introspect with a mounted sub-app (`app.parent` set) emits one `warn` `EAD_MOUNTED_IN_SUBAPP` and returns the routes of the topmost ancestor.
11. `test/describe/describe.test.ts` (AC-022): `describe(meta)` returns middleware that calls `next()` untouched, is tagged `[META]` with `source: 'describe'`, registers through `RouteRegistry.register()`, and an invalid body/query still reaches the handler with 200.

## Verification commands

Copied verbatim from architecture.md "Verification Commands":

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Gate G-S05 (run first, record RED then GREEN): `npx vitest run test/introspect/spike.contract.test.ts`

Merge rule (ADR-29, test-strategy #7): the full `npm test`, including global thresholds, must pass in this story's worktree. A focused path run is not sufficient.

## Builder Report
