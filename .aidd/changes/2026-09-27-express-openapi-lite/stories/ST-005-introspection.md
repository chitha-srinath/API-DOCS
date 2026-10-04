---
id: ST-005
title: "S-05 Introspection: recorder with installRecorder, the auto-record entry, v4 and v5 walkers, paths, describe(). Gated by G-S05"
wave: 4
status: built
attempts: 1
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
    - test/fixtures/apps.ts
    - test/fixtures/logger.ts
  creates:
    - src/introspect/
    - test/introspect/
    - test/describe/
---

# ST-005 (epic S-05): Introspection, recorder with `installRecorder`, the auto-record entry, v4 and v5 walkers, paths, `describe()`

> Id note: the epic calls this story `S-05`. The frontmatter schema requires `^ST-[0-9]{3}$`,
> so it is `ST-005` here. `ST-001` is epic S-01 and `ST-004` is epic S-04.
> Dependency: **S-01 and S-04** (ADR-27b). This supersedes "S-01 and C0".
> Risk: **high**. From the epic: "R-1 and R-8: Express private internals; patches the `use` prototype at import; APM ordering; module identity across copies; gate G-S05".
> Size: 8 source files (6 in `src/introspect/`, plus `src/route/describe.ts` and `src/auto-record.ts`). The epic accepts this: "they are one recorder/walker seam, and the extra 2 files are thin."

## Context

Greenfield repo (context pack: no re-crawl). There is no existing product code to quote. The excerpts below
are verbatim from `architecture.md` and `epic.md`. Where an ADR carries a SUPERSEDED marker, only the
superseding text is binding and is quoted here.

### Ownership (verbatim from epic.md)

> | S-05 | `src/route/describe.ts`, `src/introspect/**` (`recorder.ts` with `installRecorder`, `auto-record.ts`, `index.ts`, `express4.ts`, `express5.ts`, `paths.ts`), `src/auto-record.ts` (the side-effect tsup entry; S-01 stubs it in Wave 1 and S-05 owns it from Wave 4), `test/introspect/**`, `test/describe/**`, `test/fixtures/apps.ts`, `test/fixtures/logger.ts` | `src/introspect/`, `test/introspect/`, `test/describe/` |

> | `src/auto-record.ts` (empty) | S-01 (W1) | S-05 (W4) |

> `test/fixtures/`: `majors.ts` and `fresh-express.ts` belong to S-01, `stub-adapter.ts` to S-03, and `apps.ts` and `logger.ts` to S-05.

> Any story may import these files, but only the owner may edit them. S-01 creates the directory.

So: `src/auto-record.ts` already exists as an **empty** module created by S-01; this story fills it in.
`test/fixtures/` already exists; this story creates only `apps.ts` and `logger.ts` in it and **imports**
`majors.ts` and `fresh-express.ts` (S-01, ADR-39) without editing them.

### Gate G-S05: FIRST TASK (blocking)

From architecture.md, "Introspection spike — gate G-S05":

> **Gate.** Before S-05 is committed, `test/introspect/spike.contract.test.ts` must pass on `express@5.2.1` and `express4@npm:express@4.22.3`. It re-encodes the S-4b fixtures below: a nested Router, a mounted sub-app, a wrapped handler and a plain route. S-05 owns the test, and S-05's first task is to run it. **Status as of 2026-09-27: PASS, via the throwaway spike below** (run outside the repo, in `%TEMP%\aidd-spike`).

From epic.md, Wave 4:

> **Wave 4: S-05.** Its dependency is **S-01 and S-04** (ADR-27b), which supersedes "S-01 and C0". It takes over `src/auto-record.ts` from the S-01 stub. Its first task is gate G-S05, `test/introspect/spike.contract.test.ts` on `express@5.2.1` and `express4@4.22.3`, using `majors.ts` (ADR-39: `installRecorder` is called only for a surviving alias entry).

Order of work: (1) write `test/fixtures/logger.ts`, `test/fixtures/apps.ts` and
`test/introspect/spike.contract.test.ts` (importing `majors` from S-01's `test/fixtures/majors.ts`);
(2) run the contract test and record RED; (3) implement the recorder and walkers until it is GREEN on every
deduped major; (4) only then commit the auto-detect code and continue with the other tests.

### Spike evidence (verbatim from architecture.md)

```
$ cd "$TEMP/aidd-spike" && npm init -y && npm i express5@npm:express@5.2.1 express4@npm:express@4.22.3   exit 0
found 0 vulnerabilities
```

S-1 (static walk): v4 nested PASS, v5 nested FAIL, sub-app FAIL on both majors, wrapper FAIL on both majors. **ADR-07 as written does not hold.**
```
== express5 root=router
{"name":"router","keys":["handle","keys","name","params","path","slash","matchers","route"],"sub":"router"}  <- NO prefix string
{"name":"mounted_app",...}                                                      <- sub-app opaque
{"name":"handle",...,"route":"/w","metaDirect":[null]}                          <- tag LOST
```

S-3: an Express 5 `Router()` is a function whose prototype is a Router *instance*, so `use` lives two levels up (`sameProto false hasOwnUse false`). Hence ADR-18 says "the prototype that owns `use`".

S-4a: `Error: 'app.router' is deprecated!  at app.get (express4/lib/application.js:131)`. Reading `app.router` on Express 4 throws, so the sniff must use keys.

S-4b: the ADR-17 hybrid plus the ADR-18 recorder, exit code 0, result **PASS**. This is the expected output the contract test re-encodes:
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

### Components (current, superseded fragments removed)

- **C4** `route/describe.ts`: "`describe(meta)` returns a pass-through middleware tagged with `[META]`, `source: 'describe'`. It never validates." Per ADR-17, "`describe.ts` (S-05) only calls its `register()` API" on the S-04 `RouteRegistry`.
- **C5** (verbatim, current text): "`introspect(app, registry, log): DetectedOperation[]`. The version sniff is key-only and never reads `app.router` on v4 (ADR-27a, see Pinned seams). If `req.app.parent` exists it walks from the topmost ancestor with a warn (ADR-29). Each layer is handled in its own try/catch. Unknown shapes, unrecoverable prefixes, unmatched registry entries and unpatched Express copies are logged once at `warn` with an `EAD_*` code (ADR-19/23). Mount prefixes come from recorder annotations `[MOUNT]`/`[CHILD]`; on v4 `layer.regexp` is the fallback for pre-import mounts. Registry entries are located by `RouteRegistry.findByHandle` (ADR-17). `paths.ts` handles path conversion: `:id` becomes `{id}`, `/*rest` becomes `{rest}`, and optional segments expand into two paths. RegExp routes and unnamed `*` are skipped with exactly one `debug` line each (AC-034)."
  - VOID per its markers: "falling back to the other" (ADR-27a), "unknown shape skipped with a debug log" (ADR-19), "v5 prefix from the layer matcher or path" (ADR-18), "`[META]` tags are read here" as the primary key (ADR-17; now the fallback per ADR-44).
- **C0** (S-01, read-only): `DetectedOperation {method, path, pathParams[], source: 'typed'|'describe'|'plain', meta?}`, `Logger` (with stable `EAD_*` warn codes), the pinned `RegistryEntry`/`RouteRegistry` interfaces, and the symbols. Key names are versioned by ADR-43 (below).

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

### Binding decisions (verbatim excerpts, current)

- **ADR-17** (META made load-bearing by ADR-44; key names versioned by ADR-43): "A per-instance `RouteRegistry` records typed and `describe()` routes at declaration [...]. The stack walk (C5) does exactly two things: (a) attach mount prefixes by matching layer handles by identity against the registered `validatorFn` **or** `handlerFn`; (b) find plain routes. A registry entry that the walk cannot locate is still emitted with its local path, plus one `warn` (ADR-19)."
- **ADR-18:** "`src/introspect/recorder.ts` (S-05) wraps the `use` method on the prototype that **owns** it. Because of Express 5's two-level router prototype, this is found by walking the prototype chain. It also wraps `express.application.use`. The wrappers call the original first, then only **annotate** the newly pushed layers with `[MOUNT]=path` and `[CHILD]=subApp`. They never change dispatch. [...] Express 4 falls back to `layer.regexp` for mounts made before the import. Express 5 mounts made before the import get the local path and a `warn`. [...] **On Express 4, reading `app.router` THROWS** (spike S-4a), so the sniff must never read it."
- **ADR-19:** "These are logged at **`warn`** through the configured logger, once per layer or route per walk: a registry entry not found in the stack, an unrecognised layer shape, a mount whose prefix cannot be recovered, a `mounted_app` without `[CHILD]`, and a layer skipped because it threw. Only the AC-034 skips stay at `debug`: `RegExp` paths and unnamed `*` wildcards, which the spec expects."
- **ADR-20 as amended by ADR-43** (the ADR-20 key names `express-api-contract.meta` etc. are SUPERSEDED): "All `Symbol.for` keys are **protocol-versioned**: `express-api-contract.v1.meta`, `.v1.mount`, `.v1.child`, `.v1.recorder` and `.v1.error`." They are defined in `src/core/types.ts` (S-01). Import them; never declare your own. Local `Symbol()` is banned for any value that crosses module boundaries (ESLint-enforced).
- **ADR-43 (owner of the recorder part: S-05):** "The value stored under `RECORDER` is `{ protocol: 1, packageVersion }`. The recorder uses these rules:
  - same protocol: reuse, and log `debug` on a packageVersion difference;
  - a *newer* protocol version (v2 keys present) coexists, because each version annotates under its own keys;
  - the walker reads only its own protocol's keys.
  Any change to a payload shape **must** bump the protocol number".
- **ADR-44 (owner of the describe part: S-05):** "`[META]` is **load-bearing**. For cross-copy discovery (ESM route, CJS walker), the walker falls back to reading `[META]` when `findByHandle` misses. [...] `describe()` **must** set it on its middleware. Tests: [...] `test/introspect/describe-meta.test.ts` (S-05) assert that the tag is present and carries `{source, method?, meta}`. The S-07 dual-load test depends on this."
- **ADR-23** (isolation and warn cardinality pinned by ADR-34; sub-apps on an unpatched copy are dropped): "a public `installRecorder(expressModule)`. [...] It is idempotent through `RECORDER` on the owner prototypes. **Default install:** `src/introspect/auto-record.ts` resolves `express` from the package's own location (`createRequire(import.meta.url)` in ESM, `require` in CJS; tsup shims) and calls `installRecorder()` on it. A resolution failure is swallowed with one `warn`. [...] **Mismatch warning:** [...] if the app's router owner prototype lacks `RECORDER`, the package emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`. The message names the fix (`installRecorder(<your express>)`)." The ADR-23 phrases "at the first walk", "isolated with `vi.resetModules`" and "local-path fallback" for sub-apps are superseded by ADR-34.
- **ADR-34 (owner: S-05, fixture in S-01):** "`test/fixtures/fresh-express.ts` exports `freshExpress(alias)`. [...] returns `{ express, restore }`, where `restore` puts the saved cache entries back. `vi.resetModules` is **not** used, because vitest externalises `node_modules` CJS. **Warn cardinality:** `EAD_RECORDER_NOT_INSTALLED` fires **once per walk**. Walks happen only on a cache miss, so after `invalidate()` a second walk warns again (the test expects 2 after one `invalidate()`). **Sub-apps on an unpatched copy:** the child app has no `[CHILD]` link and cannot be reached, so its routes are **dropped** with one `warn` `EAD_SUBAPP_UNRECORDED` per `mounted_app` layer. [...] ADR-23's "local-path fallback" applies to routers only."
- **ADR-24** (build shape pinned by ADR-40, owned by S-01): "the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. `src/index.ts` begins with a bare `import './auto-record'`." `src/auto-record.ts` (owned here) is the thin side-effect entry that imports `./introspect/auto-record`. Per ADR-40 the install call must exist **only** in `dist/auto-record.{js,cjs}`; recorder code duplicated into `index`/`manual` is safe "because of the `Symbol.for` guard (ADR-20/43)". `src/index.ts`, `src/manual.ts` and `tsup.config.ts` are NOT owned here.
- **ADR-39 (majors.ts owner moved to S-01):** "`test/fixtures/majors.ts` lists `express` (the root) first and `express4` second, and dedupes by major, **keeping the first occurrence (the root copy)**. [...] `installRecorder(express4)` is called only for an alias entry that survives the dedupe. S-04, S-05, S-06 and S-07 **import** `majors.ts`. Local copies or parameterizers are forbidden, and a lint `no-restricted-syntax` rule flags `require('express4')` outside `test/fixtures/**`."
- **ADR-25** (major-specific cases, still binding): "Express 5-only cases (the `/*rest` named wildcard in AC-034, `{/:id}` optionals, the `app.router` sniff) use `it.skipIf(major !== 5)`. Express 4-only cases (`*`, `:id?`) use `skipIf(major !== 4)`." The `peer-floor` job runs `test/introspect/**` on `express@4.21.0` and `express@5.0.0` + `router@2.0.0`, so the walkers must not assume newer layer shapes.
- **ADR-29:**
  - "**CR-3:** `test/introspect/apm-order.test.ts` applies a third-party-style wrapper (`proto.use = wrap(proto.use)` plus a layer-handle wrapper) **before and after** `installRecorder`. It asserts that prefixes survive in both orders [...]. If "after" fails, it must emit `warn` `EAD_LAYER_UNRECOGNISED`, not fail silently."
  - "**CR-8:** if `req.app.parent` exists, the walk emits one `warn` `EAD_MOUNTED_IN_SUBAPP` and walks from the topmost ancestor (`while (app.parent) app = app.parent`)."
  - "**F-6:** the recorder computes "new layers" from `stack.length` **captured before** calling the original `use`. This applies in both wrappers, and the rule is stated in ST-005." **Rule for this story:** in both the router-prototype `use` wrapper and the `application.use` wrapper, read `const before = stack.length` first, then call the original, then annotate only `stack.slice(before)`.
  - "**Test-strategy #9:** each fixture gets a dedicated logger spy, and warn assertions filter by the stable message `code` (`EAD_*`)."
  - "**Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient."
- **ADR-27d:** Stryker `mutate` covers `src/introspect/**` and `src/route/**` (among others). `thresholds.break` stays at 70 (command runner per ADR-35, S-01).
- **ADR-32:** "S-05 keeps only the walk half (methods, full path, `pathParams`)." The AC-023 Then-clause on the spec (operationId, `200`, tag `api`) is asserted by S-06 in `test/spec/ac023.test.ts`, which imports this story's `test/fixtures/apps.ts`.
- Detection never throws (R-1: "degradation to 'undocumented' instead of an exception").

### Boundaries

- Do NOT edit: `package.json`, `tsup.config.ts`, `eslint.config.js`, `vitest.config.ts`, `vitest.stryker.config.ts`, `stryker.config.mjs`, `.github/**`, `src/core/types.ts`, `test/fixtures/majors.ts`, `test/fixtures/fresh-express.ts` (S-01); `test/fixtures/stub-adapter.ts` (S-03); `src/registry/**` or the other five `src/route/*` files (S-04); `src/spec/**` (S-06); `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `test/entries/**` (S-07); `README.md` (S-08; it documents the CR-3 result and the ADR-43 Internals note). Need something there: record it in the Builder Report.
- The spec side of AC-023/030/031/033/034 (operationId, tag `api`, `exclude` glob, dedupe, self-exclusion, byte identity) belongs to S-06. This story delivers the walk side: correct, deterministic `DetectedOperation[]` with `source` and `meta`, so S-06 can dedupe and exclude.
- The dual-load, bundle and recorder-install tests (ADR-20, ADR-24, ADR-40 runtime half, ADR-44) belong to S-07; this story must make them passable by using only the versioned `Symbol.for` identities, setting `[META]` on `describe()` middleware, and keeping the install call only in `src/auto-record.ts`.

## Acceptance criteria (from PRD)

- **AC-022** Given a plain handler wrapped with the `describe()` middleware, When the spec is generated, Then the route appears with its declared metadata, and invalid requests to it are not rejected (docs only).
- **AC-023** (walk half, ADR-32) Given plain routes registered without the typed helper or `describe()`, on Express 4 and on Express 5 (tested separately), including a nested router mounted with `app.use('/api', router)` that has `router.get('/users/:id')` and `router.post('/users/:id')`, When the spec is generated, Then auto-detection walks the router stack and the spec contains path `/api/users/{id}` with exactly one `get` and one `post` operation. Each has an `operationId`, a required `path` parameter `id` with schema `type: string`, a generic `200` response, and the tag `api`.
- **AC-030** (walk) Given `autoDetect: false`, When the spec is generated, Then no plain route appears in it. Given `autoDetect` is left at its default and `exclude: ['/internal/**']`, When the spec is generated, Then plain routes under `/internal/` are absent and other plain routes are present.
- **AC-031** (identity match) Given the same method and path registered both as a typed route (or with `describe()`) and as a plain route that auto-detection would find, When the spec is generated, Then exactly one operation exists for that method and path, and it carries the typed or `describe()` metadata.
- **AC-032** (walk) Given the spec middleware is mounted before a plain route is added, When the first spec request arrives after that route was added, Then the route appears in the spec.
- **AC-033** (detection) Given auto-detection is enabled, When the spec is generated, Then the package's own spec endpoint and docs endpoint paths do not appear in it.
- **AC-034** Given plain routes registered with a `RegExp` path, an Express 4 `*` wildcard and an Express 5 named wildcard `/*rest`, When the spec is generated twice, Then generation does not throw; the RegExp and unnamed-wildcard routes are skipped with one debug log line each; the named wildcard maps to `{rest}`; and both generated specs are byte-identical.

## Test plan

Write tests FIRST and capture the failing run before any implementation. Every suite imports `majors` from
S-01's `test/fixtures/majors.ts` and iterates it (`describe.each(majors)`); no local parameterizer and no
`require('express4')` outside `test/fixtures/**` (ADR-39). Major-specific cases use `it.skipIf(major !== 5)` /
`it.skipIf(major !== 4)` (ADR-25). Every fixture gets its own logger spy from `test/fixtures/logger.ts`; warn
assertions filter by `EAD_*` code (ADR-29 #9).

0. **Fixtures (owned here).**
   - `test/fixtures/logger.ts`: `makeLoggerSpy()` returning `{ log, warns(code?), debugs() }`, backed by `vi.fn()`.
   - `test/fixtures/apps.ts`: `makeApp({ major, express })` building the S-4b set: `app.use('/api', r)` with `r.get('/users/:id')` and `r.post('/users/:id')`; `app.use('/v1', subApp)` with `subApp.get('/items/:id')`; `app.get('/w', wrap(taggedHandler))`; `app.get('/plain')`. S-06's `ac023.test.ts` imports it, so keep the export stable.
1. **G-S05: `test/introspect/spike.contract.test.ts` (first, blocking).** For each entry of `majors`, `introspect(app, registry, log)` returns (sorted) `GET /api/users/{id}` meta=nested, `GET /v1/items/{id}` meta=subapp, `GET /w` meta=wrapped, `GET /plain` with `source: 'plain'` and no meta. No registry entry is missing from the walk (zero `warn` calls). The walk does not throw.
2. `test/introspect/walk.test.ts`
   - `/api/users/{id}` has exactly one `get` and one `post`, `pathParams` equal to `['id']` (AC-023 walk half).
   - a plain route added after the spec middleware is mounted is found on the next walk (AC-032).
   - `autoDetect: false` yields no `source: 'plain'` ops; registry routes are still present (AC-030 walk side).
   - a typed or `describe()` route and the same plain method/path: the detected op carries `source` typed/describe and its meta, via `findByHandle` identity match (AC-031 walk side).
   - `findByHandle` miss with a `[META]`-tagged handle (simulated other-copy route, empty registry): the op is still emitted with that meta via the `[META]` fallback (ADR-44).
   - the package's own spec and docs paths are omitted from the detected set (AC-033 detection side).
3. `test/introspect/sniff.test.ts` (ADR-27a): on v4 (`skipIf(major !== 4)`), define an `app.router` getter that throws; `introspect` succeeds and the getter is never called. On v5 (`skipIf(major !== 5)`), the root is `app.router`.
4. `test/introspect/paths.test.ts` (AC-034): `:id` becomes `{id}`; `/*rest` becomes `{rest}` (v5 only); `{/:id}` optional expands into two paths (v5 only); `:id?` expands into two paths (v4 only); unnamed `*` (v4 only) and a RegExp path are each skipped with exactly one `debug` call and no throw; two walks give deep-equal output.
5. `test/introspect/warn.test.ts` (ADR-19): exactly one `warn` per case per walk, filtered by `EAD_*` code: registry entry not in the stack (validator and handler both wrapped, emitted at local path), unrecognised layer shape, unrecoverable mount prefix (v5 router mount made before install: local path + warn), `mounted_app` without `[CHILD]`, and a layer whose inspection throws.
6. `test/introspect/recorder.test.ts` (ADR-18, ADR-23, ADR-43, F-6):
   - `installRecorder` called twice wraps `use` once (`RECORDER` guard on the owner prototype, found by walking the prototype chain on v5);
   - the stored `RECORDER` value deep-equals `{ protocol: 1, packageVersion }`; a pre-existing same-protocol guard with a different `packageVersion` is reused (no re-wrap) with one `debug`; a pre-existing `Symbol.for('express-api-contract.v2.recorder')` guard does not prevent v1 installation and the walker reads only `.v1.*` keys;
   - only layers from `stack.slice(before)` get `[MOUNT]`/`[CHILD]`, where `before` is captured before calling the original (a `use` that pushes several layers), in both the router-prototype and `application.use` wrappers;
   - dispatch is unchanged (a supertest request still reaches the handler);
   - the identities equal `Symbol.for('express-api-contract.v1.meta' | '.v1.mount' | '.v1.child' | '.v1.recorder')` as imported from `src/core/types.ts`.
7. `test/introspect/recorder-mismatch.test.ts` (ADR-23, ADR-34): use `freshExpress('express4')` from S-01's `test/fixtures/fresh-express.ts` (never `vi.resetModules`); call `restore()` in `afterEach`. Build an app from the un-installed copy with a nested router and a mounted sub-app:
   - the walk emits exactly one `warn` `EAD_RECORDER_NOT_INSTALLED` whose message contains `installRecorder(`;
   - router routes fall back to local paths;
   - sub-app routes are dropped, with exactly one `warn` `EAD_SUBAPP_UNRECORDED` per `mounted_app` layer;
   - after one `invalidate()` and a second walk, the `EAD_RECORDER_NOT_INSTALLED` count is 2 (once per walk).
8. `test/introspect/auto-record.test.ts` (ADR-23, ADR-24): importing `src/auto-record.ts` installs the recorder on the resolved root `express` (its owner prototype carries `RECORDER`); a simulated resolution failure is swallowed with one `warn`.
9. `test/introspect/apm-order.test.ts` (CR-3): a third-party-style wrapper (`proto.use = wrap(proto.use)` plus a layer-handle wrapper) applied before and after `installRecorder`. Prefixes survive in both orders, or, if "after" cannot recover them, exactly one `warn` `EAD_LAYER_UNRECOGNISED` is emitted (never silent). Record the observed result in the Builder Report for S-08's README.
10. `test/introspect/subapp-parent.test.ts` (CR-8): introspecting a mounted sub-app (`app.parent` set) emits one `warn` `EAD_MOUNTED_IN_SUBAPP` and returns the routes of the topmost ancestor.
11. `test/introspect/describe-meta.test.ts` (ADR-44): the middleware returned by `describe(meta)` has `[META]` (`Symbol.for('express-api-contract.v1.meta')`) whose value carries `{ source: 'describe', method?, meta }`.
12. `test/describe/describe.test.ts` (AC-022): `describe(meta)` returns middleware that calls `next()` untouched, registers through `RouteRegistry.register()` with `source: 'describe'`, and an invalid body/query still reaches the handler with 200 on each major.

## Verification commands

Copied verbatim from architecture.md "Verification Commands" (runner per ADR-35):

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- mutation: `npx stryker run --mutate "src/route/describe.ts,src/introspect/**,src/auto-record.ts" --incremental` (per-story scoped run per ADR-50, which supersedes ADR-35's mutation command; `thresholds.break: 70` applies to this scope)
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Gate G-S05 (run first, record RED then GREEN): `npx vitest run test/introspect/spike.contract.test.ts`

Merge rule (ADR-29, test-strategy #7): the full `npm test`, including global thresholds, must pass in this story's worktree. A focused path run is not sufficient.

## Builder Report

**Status: built.**

### Ownership / architect-backflow note

Per the dispatch, this story's design correlates with the registry via `RouteRegistry.findByHandle`
identity matching only — it never depends on `route()`'s call signature or on `RegistryEntry.method`/
`localPath` *values* being anything in particular (only that they exist and are matched by handle
identity when present in the stack). I confirmed this while implementing `src/introspect/index.ts`:
the walker calls `registry.findByHandle(handlerFn)` and, on a miss, falls back to the `[META]` tag
(ADR-44) — neither path inspects how `route()` built the tuple it returned. **Unaffected** by the
ST-004 `route()` 4-arg-vs-2-arg ADR dispute; no blocker.

### Gate G-S05 (first task, blocking)

Wrote `test/fixtures/logger.ts`, `test/fixtures/apps.ts` and `test/introspect/spike.contract.test.ts`
before any `src/introspect/**` implementation existed. First run (RED — module not found):

```
$ npx vitest run test/introspect/spike.contract.test.ts
Error: Cannot find module '../../src/introspect/index.js' imported from
  test/introspect/spike.contract.test.ts
 FAIL  test/introspect/spike.contract.test.ts [ 2 failed ]
```

After implementing `src/introspect/sniff.ts`, `paths.ts`, `recorder.ts`, `index.ts` (GREEN):

```
$ npx vitest run test/introspect/spike.contract.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
Type Errors  no errors
   Duration  7.78s
```

Both majors (`express@5.2.1` root, `express4@npm:express@4.22.3` alias) pass with zero `warn` calls,
matching the S-4b expected output shape.

### Red → Green for the rest of the suite

While wiring up `test/introspect/{walk,sniff,paths,warn,recorder,recorder-mismatch,auto-record,
apm-order,subapp-parent}.test.ts` and `test/describe/describe.test.ts`, I hit and fixed two real
production bugs mid-TDD (both now covered by regression tests):

1. **Express 4's `app.router` getter throws** (spike S-4a) — the v4 sniff never reads it; confirmed via
   a `Proxy`-based test since the real getter is non-configurable and can't be monkey-patched directly.
2. **`typeof root === 'object'` excluded Router instances** (they are callable functions) — this
   silently defaulted `recorderInstalled` to `true` for every walk, masking the ADR-34 "local-path
   fallback" / `EAD_RECORDER_NOT_INSTALLED` path entirely. Found via `recorder-mismatch.test.ts` going
   green with 0 warns when it should have reported 1; fixed by guarding on nullishness instead of
   `typeof`.

Representative RED excerpt (recorder-mismatch, before the `typeof` fix):

```
FAIL test/introspect/recorder-mismatch.test.ts > ... > warns EAD_RECORDER_NOT_INSTALLED once...
AssertionError: expected [] to have a length of 1 but got +0
```

GREEN after the fix — full `test/introspect/**` + `test/describe/**`:

```
$ npx vitest run test/introspect test/describe --no-coverage
 Test Files  12 passed (12)
      Tests  60 passed | 3 skipped (63)
Type Errors  no errors
```

### Full verification commands (final, all green)

```
$ npm test                     # vitest run --coverage --typecheck
 Test Files  47 passed (47)
      Tests  273 passed | 5 skipped (278)
Type Errors  no errors
Statements   : 97.62% ( 534/547 )
Branches     : 90.13% ( 329/365 )   >= 90% threshold
Functions    : 97.5%  ( 117/120 )
Lines        : 98.61% ( 500/507 )
Exit code: 0
```

```
$ npm run lint                 # eslint . && prettier --check .
0 errors, 0 warnings
All matched files use Prettier code style!
Exit code: 0
```

```
$ npx tsc --noEmit
(no output — 0 errors)
Exit code: 0
```

```
$ npx stryker run --mutate "src/route/describe.ts,src/introspect/**,src/auto-record.ts" --incremental
(first attempt hit a stale-sandbox ConfigError from a prior interrupted run; cleared `.stryker-tmp/`
 and `reports/` and retried once, per instruction)
All files        | 100.00 |  100.00 |      402 |         2 |          0 |        0 |        0 |
 introspect      | 100.00 |  100.00 |      394 |         2 |          0 |        0 |        0 |
  auto-record.ts | 100.00 |  100.00 |       11 |         0 |          0 |        0 |        0 |
  index.ts       | 100.00 |  100.00 |      206 |         0 |          0 |        0 |        0 |
  paths.ts       | 100.00 |  100.00 |       82 |         0 |          0 |        0 |        0 |
  recorder.ts    | 100.00 |  100.00 |       80 |         2 |          0 |        0 |        0 |
  sniff.ts       | 100.00 |  100.00 |       15 |         0 |          0 |        0 |        0 |
 route           | 100.00 |  100.00 |        8 |         0 |          0 |        0 |        0 |
  describe.ts    | 100.00 |  100.00 |        8 |         0 |          0 |        0 |        0 |
Final mutation score of 100.00 is greater than or equal to break threshold 70
Done in 48 minutes and 35 seconds.
Exit code: 0
```
(2 timeouts on `recorder.ts`, both counted as killed for scoring purposes by Stryker — 0 survived.)

### AC self-check

- **AC-022** (describe, docs-only) — `test/describe/describe.test.ts`: registers via `RouteRegistry.register`
  with `source: 'describe'`, middleware calls `next()` untouched, an "invalid" request (bad `:id`, bogus
  query) still reaches the handler with 200 on both majors. **PASS.**
- **AC-023** (walk half) — `test/introspect/walk.test.ts` + `spike.contract.test.ts`: `/api/users/{id}`
  yields exactly one `get` and one `post`, `pathParams: ['id']`, on both majors via `describe.each(majors)`.
  (The spec-side assertions — operationId, `200`, tag `api` — are explicitly S-06's, per Boundaries.)
  **PASS (walk side).**
- **AC-030** (walk side) — `walk.test.ts`: `autoDetect: false` suppresses `source: 'plain'` ops while
  registry-sourced ops remain. (The `exclude: ['/internal/**']` glob half is S-06's; this story exposes
  `ownPaths`/`autoDetect` as the `IntrospectOptions` seam S-06 will drive.) **PASS (walk side).**
- **AC-031** (identity match) — `walk.test.ts`: same method+path registered once via the registry and
  once as a plain route dedupes to one op carrying the typed meta, via `findByHandle`. **PASS.**
- **AC-032** (late-mounted route) — `walk.test.ts`: a route added after the spec middleware is first
  used is found on the next `introspect()` call. **PASS.**
- **AC-033** (own-path exclusion) — `walk.test.ts`: `ownPaths` option filters the package's own
  spec/docs paths out of the detected set. **PASS.**
- **AC-034** (RegExp/wildcards, byte-identity) — `paths.test.ts` + `warn.test.ts`: `:id`→`{id}`,
  `/*rest`→`{rest}` (v5), `{/:id}`/`:id?` expand to two paths, RegExp and unnamed `*` each skip with one
  `debug` and no throw, two calls are deep-equal (determinism proxy for "byte-identical" — the actual
  spec-serialization byte-identity check is S-06's, since this story only returns `DetectedOperation[]`,
  not a serialized spec). **PASS (walk side).**

### CR-3 (apm-order) observed result, for S-08's README

Both orders (third-party `use` wrapper before `installRecorder`, and after) preserved mount prefixes
correctly in my test's transparent-passthrough wrapper shape (`owner.use = (...args) => original.apply(this, args)`).
Neither order fell back to the `EAD_LAYER_UNRECOGNISED` warn path in this scenario. A wrapper that
*replaces* `this` context or drops arguments could still break prefix recovery, but the recorder itself
never silently swallows such a failure — it degrades to the `EAD_LAYER_UNRECOGNISED` warn on the router
side, verified separately in `warn.test.ts`.

### Design decisions not fully pinned by the story text

- **`describe()` signature**: implemented as a factory, `createDescribe({ registry })` returning
  `describe(method, localPath, meta): RequestHandler`, mirroring ST-004's `route()` shape (needed because
  `RegistryEntry` requires `method`/`localPath` at registration time). The story's shorthand `describe(meta)`
  in the epic/test-plan prose is the conceptual call; S-06/S-07 only depend on the `[META]` tag shape and
  the registry entry's `source: 'describe'`, not on this exact arg list.
- **`EAD_RECORDER_NOT_INSTALLED` / local-path fallback vs. the `layer.regexp` fallback**: ADR-18's
  regexp-based mount-prefix recovery and ADR-34's "local-path fallback" are two different situations —
  the former is for a specific pre-import mount on an otherwise-recorded copy (still warns
  `EAD_MOUNT_PREFIX_UNRECOVERABLE` if it can't parse the regexp); the latter is for a copy where
  `installRecorder` was never called at all (one `EAD_RECORDER_NOT_INSTALLED` per walk, no per-layer
  regexp attempt, matching the ADR-34 test-plan wording exactly).

### Known non-blocking finding for S-07 (build-shape)

`tsup`'s build (via `package.json`'s `sideEffects` array, which lists `./dist/auto-record.js`/`.cjs`
but not the `src/introspect/auto-record.ts` source path) causes esbuild to **drop the entire
`import './introspect/auto-record.js'` statement** from both `dist/auto-record.js` (0 bytes) and
`dist/auto-record.cjs` (empty exports only) — visible as a build warning: `"Ignoring this import
because 'src/introspect/auto-record.ts' was marked as having no side effects"`. This does **not**
affect this story's own tests (they import `src/auto-record.ts` directly via vitest, which doesn't
bundle/tree-shake), and none of ST-005's ACs touch the dist bundle. But it means the *real* published
package's auto-detect side effect currently never fires, which is squarely ST-007's dual-load/bundle
concern (Boundaries: "the dual-load, bundle and recorder-install tests ... belong to S-07"; `tsup.config.ts`
and `package.json` are both outside this story's ownership). Recommend S-07 (or an architect follow-up)
add `src/introspect/auto-record.ts` to the `sideEffects` array, or restructure the esbuild plugin in
`tsup.config.ts` so the external-rewrite happens before esbuild's side-effect-based import elision.

### Ownership-scoped diff

```
$ git diff --stat -- src/introspect src/route/describe.ts src/auto-record.ts test/introspect test/describe test/fixtures/apps.ts test/fixtures/logger.ts
 src/auto-record.ts                        |   5 +
 src/introspect/auto-record.ts             |  34 ++
 src/introspect/index.ts                   | 273 ++++++++++++++++++++++++++++++
 src/introspect/paths.ts                   |  77 +++++++
 src/introspect/recorder.ts                | 145 ++++++++++++
 src/introspect/sniff.ts                   |  29 ++
 src/route/describe.ts                     |  39 +++
 test/describe/describe.test.ts            |  32 ++
 test/fixtures/apps.ts                     |  57 +++++
 test/fixtures/logger.ts                   |  33 ++
 test/introspect/apm-order.test.ts         |  69 +++++
 test/introspect/auto-record.test.ts       |  48 +++
 test/introspect/describe-meta.test.ts     |  16 ++
 test/introspect/paths.test.ts             |  76 +++++
 test/introspect/recorder-mismatch.test.ts |  60 +++++
 test/introspect/recorder.test.ts          | 129 +++++++++
 test/introspect/sniff.test.ts             |  45 +++
 test/introspect/spike.contract.test.ts    |  41 +++
 test/introspect/subapp-parent.test.ts     |  28 ++
 test/introspect/walk.test.ts              | 114 +++++++
 test/introspect/warn.test.ts              | 173 +++++++++
 21 files changed, 1523 insertions(+)
```

All changed/created files are within the declared `file_scope.owns`/`creates` set. No file outside
that set was touched.

**Frontmatter updated: `status: built`, `attempts: 1`.**

## Auditor Report

**Verdict: all 7 claimed ACs PROVEN (AC-022, AC-023 walk half, AC-030, AC-031, AC-032,
AC-033, AC-034). Gate G-S05 independently re-run and PROVEN (2 tests, both express
majors, zero warns). Zero challenge rounds needed** — full verdict with cited re-executed
evidence in `audit/interrogation/ST-005-verdict.md`.

Independently re-ran `test/introspect/spike.contract.test.ts` and the full
`test/introspect`/`test/describe` suites (12 files, 72 passed / 5 skipped) rather than
trusting the Builder Report's pasted output. Read every cited test file directly to
confirm assertions actually match each AC's Given/When/Then, and confirmed the
walk-only scoping of AC-023/030/034 (spec-side deferred to S-06) against the story's own
Boundaries/ADR-32 text — not a gap, a correct scope split.

Independently reproduced the ADR-50 mutation claim by parsing the raw
`reports/stryker-incremental.json` (not the printed table): 404 total mutants, 402
killed, 2 timeout, 0 survived, 0 no-coverage — exact match to the Builder's claimed row,
over the exact ADR-50 file scope (6 files, no creep). The unusually high 100.00% score is
independently corroborated, not merely asserted.

Noted but explicitly did not dispute: the dist-bundling `sideEffects` elision defect
(reproduced during `npm test`'s pretest build) is out of scope for this story per the
interrogation dispatch — none of ST-005's ACs test against the built bundle.

## Auditor Report (QA step 12 — final audit)

Interrogated AC-022, AC-023, AC-030, AC-031, AC-032, AC-033, AC-034 (this story's share).
Independently re-ran `npx vitest run test/introspect/walk.test.ts test/spec/ac023.test.ts`
(14/14 passed) and read both files' assertions against AC-023's full Given/When/Then text
(path template, method set, operationId, required path param typing, 200 response, tags) —
match confirmed, not a partial slice.

**Verdict: AC-022, AC-023, AC-030, AC-031, AC-032, AC-033, AC-034 — all PROVEN.**
No DISPUTED ACs for this story. Full matrix: `audit/interrogation/qa-final-verdict.md`.

## Test Report (QA step 14 — g_test_report approved 2026-09-30)

Approved by human (let-me-look). Consolidated `qa/test-report.md`: 237+3 exhaustive cases,
all PASS, 0 open FAILs. Full suite 79/79 files, 644/649 tests (5 legit skips), coverage
98.56/93.35/99.45/99.34%. This story's claimed ACs are covered — see `ac-matrix.md` and
this story's `## Auditor Report` section above for per-AC verdicts.
