# Pre-Implementation Review Findings — coupling-risk (RE-RUN #2, Supervisor V6)

<!-- Reviewer mode=pre, re-run against the CURRENT plan: architecture.md (ADR-20..ADR-48), prd.md (47 ACs, AC-047, zod ^4.2.0), epic.md, stories/ST-001..008. -->
<!-- Probes (Git Bash, exit 0): grep -n "ADR-3[2-9]|ADR-4[0-8]" architecture.md -> rows :97-113; grep -c ApiDocsSchemaError stories/ST-007*.md -> 7 (was 0); grep -on keepAutoRecordExternal -> architecture.md:105, epic.md:26,73, ST-001:137; grep hasInstance -> ST-001:88, ST-002:71,146, ST-003:99,113,160; grep "keepNames|minif" stories architecture epic -> no match; grep packageVersion -> ST-005:152-153,213, ST-001:90, ST-008:79 (no source of the value is specified). -->

## Status of prior findings

| # | Prior sev | Status | Evidence |
|---|---|---|---|
| CR-1..CR-8 | HIGH/MEDIUM/LOW | RESOLVED (unchanged) | These were resolved in re-run #1 by ADR-20, 23, 27a/b/c and 29. ADR-43 renames the keys to `v1.*`, and ADR-34 amends the ADR-23 isolation. Neither reopens these findings. |
| CR-9 | LOW | RESOLVED, residual waived | ADR-25/ADR-30 are unchanged. ADR-47 adds a `zod@4.2.0` floor to the peer-floor job. |
| CR-10 | LOW | RESOLVED | ADR-40 closes the build-time gap that CR-11 found (see below). |
| CR-11 | MEDIUM | RESOLVED | ADR-40 (architecture.md:105): `splitting:false`, `shims:true` and the `keepAutoRecordExternal` plugin. ST-001:137 and :234-236 add `build-shape.test.ts`, which asserts `import "./auto-record.js"` / `require("./auto-record.cjs")`, that neither index file contains the install call, and that there are no chunks. |
| CR-12 | MEDIUM | RESOLVED | ADR-41 (:106) sets the exact export set for `.`/`./manual`, including `ApiDocsSchemaError`. C9 is marked superseded (:45). ST-007 now mentions `ApiDocsSchemaError` 7 times, and the parity test asserts the exact name set. |
| CR-13 | MEDIUM | RESOLVED, but the fix introduces CR-16 | ADR-42 (:107): a brand plus `static [Symbol.hasInstance]`. S-02 covers this at ST-002:71/146, S-03 at ST-003:99/113/160, and the S-07 dual-load test checks both directions (ST-007:163). |
| CR-14 | LOW | RESOLVED, residual see CR-17 | ADR-43 (:108): `express-api-docs.v1.*` keys and `RECORDER = {protocol:1, packageVersion}`. Tests are in ST-001:90/264 and ST-005:213. |
| CR-15 | LOW | RESOLVED | ADR-44 (:109): `[META]` is load-bearing on the validator, the handler and the `describe()` middleware. Tests are `meta-tag.test.ts` (ST-004:101/181) and `describe-meta.test.ts` (ST-005:157/225). |

No finding regressed.

## New findings introduced by ADR-32..ADR-48

| # | Severity | Artifact | Claim | Concrete risk scenario | Cited repo evidence |
|---|---|---|---|---|---|
| CR-16 | MEDIUM | ADR-42 / ST-002:71, ST-003:99/113 | `static [Symbol.hasInstance](x) { return x[BRAND] === this.name }` compares the instance brand with the class's **`Function.name`**. The brand itself comes from the instance field `name = 'ApiDocsSchemaError'`, which is a string literal. Minifiers mangle `Function.name` but leave string literals alone, so the two values stop matching. The check also fails for subclasses. | A consumer bundles its server with esbuild/terser `minify: true` and without `keepNames`, which is common for serverless deploys. The class `ApiDocsSchemaError` becomes `class t`, so the static `this.name` is `"t"`, while the instance brand is still `"ApiDocsSchemaError"`. `err instanceof ApiDocsSchemaError` is then **false even within a single copy**, and the user's error middleware misroutes the honest 500 (AC-024/ADR-37). The same happens when a user subclasses a package error: `class MyErr extends ApiDocsConfigError` gets `this.name === 'MyErr'` statically, so no instance ever matches. No planned test minifies. Fix: compare with a static string constant (`static readonly BRAND_NAME = 'ApiDocsSchemaError'`) and walk the prototype chain for subclasses. Add a dual-load case that runs over an esbuild `minify:true` bundle (S-07 already owns the bundle test). | ST-003:113 (`name = 'ApiDocsSchemaError'` as a field; the constructor sets `this[BRAND] = this.name`); ST-002:71, ST-001:88 (the verbatim `=== this.name`); a grep for `keepNames\|minif` across the plan returns nothing. |
| CR-17 | LOW | ADR-43 "newer protocol coexists" × ADR-44 load-bearing META | Walkers read only their own protocol's keys. A route that a protocol-2 copy tags with `[v2.meta]` is therefore invisible as a *typed* route to a v1 walker, and nothing warns about it. Each protocol's recorder also wraps `use` independently. | A plugin library depends on express-api-docs 0.3 (protocol 2) and exports a router built with its `api.route()`. The app uses 0.2 (protocol 1) `createApiDocs()`. The v1 walker sees the plugin's routes as plain routes with no schemas and no operation metadata, so the spec silently loses the plugin's documentation. `use` is also wrapped twice. Fix: when the v1 walker sees a handler with a foreign-protocol `Symbol.for('express-api-docs.v*.meta')` key, or a foreign `RECORDER`, emit one `warn` `EAD_PROTOCOL_MISMATCH`, and add that case to ST-005:213. | architecture.md:108 ("walker reads only its own protocol's keys"); :109 (META is the only cross-copy bridge); ST-005:213 (asserts only that a v2 guard does not block v1 install). |
| CR-18 | LOW | ADR-43 `packageVersion` / ADR-48 | The plan pins the value stored under `RECORDER` as `{protocol:1, packageVersion}` but never says where `packageVersion` comes from. The easiest route is a runtime read of `package.json`, which couples `src/introspect/**` to the dist layout and the ADR-48 export. | An S-05 builder writes `createRequire(import.meta.url)('../package.json').version`. That works from `src/` in vitest, but from `dist/auto-record.cjs` the relative path points one level too high, and the read fails in bundlers that inline the file. Per ADR-23 the install failure is "swallowed with one warn", so the recorder is never installed and Express 5 prefixes are lost. Fix: inject it at build time with tsup `define: { __EAD_VERSION__: JSON.stringify(pkg.version) }` (S-01, `tsup.config.ts`), and add a `build-shape.test.ts` assertion that `dist/*.js` contains no `package.json` read. | ST-005:152-153, :213 (the value is asserted, but its source is not specified); ST-001:137 (tsup options list has no `define`); architecture.md:88 (install failure swallowed with a warn), :113 (ADR-48). |
| CR-19 | LOW | ADR-40 `splitting:false` + `treeshake:false` | With no shared chunks, each entry (`index`, `manual`, `auto-record`) gets its own copy of the recorder and walker **module state**, even within one format. This is safe only while every piece of cross-module state is `Symbol.for`-keyed on shared objects. No rule forbids module-level mutable state in `src/introspect/**`. | A builder adds a module-level `let warned = false` or a `WeakMap` for child links in `recorder.ts`. `dist/auto-record.js` fills its own copy, while the walker in `dist/index.js` reads an empty one. Sub-app links are lost, or the ADR-34 warn cardinality doubles. The unit tests run from `src/` with a single module graph, so they stay green, and only the dist-level tests might catch it. Fix: add a lint rule or an ST-005 note: "no module-level mutable state in `src/introspect/**`; all state lives under the v1 symbols". Add a dist test that installs through `auto-record.js` and walks a sub-app through `index.js`. | architecture.md:105 ("Recorder *code* is duplicated into `index`/`manual`, which is safe because of the `Symbol.for` guard"); ST-001:137. |

<!-- Severity: CRITICAL blocks G2 until resolved; HIGH needs resolution or explicit waiver; MEDIUM/LOW advisory. -->
<!-- Checked and not raised: ADR-38 adapter resolution is instance-bound via `api.route` (architecture.md:25), so there is no ambient global. ADR-39 has a single owner of majors.ts (S-01). ADR-32 splits AC-023 by wave with no reverse import. ADR-45 dedupes esbuild. ADR-47 moves the peer floor with a matching CI floor test. -->

## Resolution log

| # | Resolution |
|---|---|
| CR-1..CR-8 | resolved (re-run #1) |
| CR-9 | resolved; residual waived — ADR-25, ADR-30, ADR-47 |
| CR-10 | resolved — ADR-24 + ADR-40 |
| CR-11 | resolved — ADR-40; ST-001 |
| CR-12 | resolved — ADR-41; ST-007, ST-003 |
| CR-13 | resolved — ADR-42; ST-002, ST-003, ST-007 (see CR-16) |
| CR-14 | resolved — ADR-43; ST-001, ST-005 (see CR-17) |
| CR-15 | resolved — ADR-44; ST-004, ST-005 |
| CR-16 | open (MEDIUM) |
| CR-17 | open (LOW) |
| CR-18 | open (LOW) |
| CR-19 | open (LOW) |
