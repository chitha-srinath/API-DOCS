# Pre-Implementation Review Findings — feasibility (RE-RUN #2, Supervisor V6)

<!-- Reviewer mode=pre. Re-run against the amended plan: architecture.md ADR-32..48, prd.md (47 ACs, zod ^4.2.0), epic.md, stories/ST-001..008. Greenfield repo: evidence is the plan artifacts (file:line) plus live read-only npm registry probes run 2026-09-27. -->

## Probes (Git Bash, all exit 0)

```
$ npm view esbuild@~0.27.7 version           -> 0.27.7
$ npm view zod@4.2.0 version                 -> 4.2.0
$ npm view zod@^4.6.5 version                -> 4.6.5   (dist-tags.latest = 4.6.5)
$ npm view @types/express@4.17.25 version    -> 4.17.25
$ npm view @types/express@4.17.25 dependencies -> @types/express-serve-static-core ^4.17.33, @types/serve-static ^1, ...
$ npm view express@4.22.3 version            -> 4.22.3   (ST-001:289 v4 typecheck command)
$ npm view @stryker-mutator/core version engines -> 10.0.0, node >=22.0.0
$ npm view tsup@8.5.1 peerDependencies       -> typescript >=4.5.0 (no esbuild peer; dep esbuild ^0.27.0, prior probe)
# ADR-47 floor claim, verified by install in the scratchpad:
$ node -e "...z.object({a:z.string()})['~standard'].jsonSchema"
  zod 4.1.13 -> undefined
  zod 4.2.0  -> object, keys ["input","output"]
```

Every new pin exists. `esbuild ~0.27.7` falls inside tsup 8.5.1's `^0.27.0` and vite 8.3.1's `^0.27.0 || ^0.28.0`, so a single deduped copy is used. The zod `^4.2.0` floor is empirically correct. Stryker 10 runs on the Node {22,24} matrix.

## Prior findings: status

| # | Prior sev | Status | Evidence |
|---|---|---|---|
| F-1 | HIGH | **RESOLVED** (unchanged) | ADR-22. ADR-46 hardens it: ST-001:152,240 assert `matrix.node` deep-equals `[22, 24]`. |
| F-2 | MEDIUM | **RESOLVED** (unchanged) | ADR-22 and ST-001 pre-declare vite and @types/node. |
| F-3 | HIGH | **RESOLVED**, strengthened | ADR-20 plus ADR-43 (versioned `express-api-contract.v1.*` keys), ADR-42 (error brand) and ADR-44 (`[META]` is load-bearing for the cross-copy walk). The dual-load test is owned by S-07. |
| F-4 | MEDIUM | **RESOLVED** | ADR-24 plus ADR-40. The install call exists only in `dist/auto-record.{js,cjs}`, which matches the `sideEffects` list, and `test/dist/build-shape.test.ts` checks this (ST-001:137). |
| F-5 | MEDIUM | **RESOLVED** (unchanged); ADR-34 refines it | ADR-23. ADR-34 pins the warn cardinality and the fate of sub-apps on unpatched copies. |
| F-6 | LOW | **RESOLVED** (unchanged) | ADR-29, ST-005. |
| F-7 | LOW | Closed (informational) | ADR-30. ADR-39 moves `majors.ts` and `fresh-express.ts` to S-01, which removes the S-04→S-05 fixture dependency. |
| N-1 | HIGH | **RESOLVED** | ADR-40 sets `splitting: false` and adds the `keepAutoRecordExternal` plugin. ST-001:137 quotes it. The build-shape test asserts that no `dist/chunk-*` file exists and that neither index file contains the install call. |
| N-2 | MEDIUM | **RESOLVED** | ADR-40 sets `shims: true`. The build-shape test asserts that `dist/auto-record.cjs` has no bare `import.meta`, and a child-process `require('./dist/index.cjs')` installs RECORDER with zero `EAD_*` warns (ST-001:137). |
| N-3 | LOW | **RESOLVED** | ADR-45 pins `esbuild@~0.27.7` (ST-001:123), and `manifest.test.ts` asserts `~0.27.x`. Probe: 0.27.7 exists. |
| N-4 | LOW | **RESOLVED** | ADR-46. ST-001 now quotes the current C10 row (ST-001:78), `grep "node {20" stories/` returns nothing, and the meta-test forbids Node 20. |

No regressions found.

## New findings introduced by ADR-32..48

| # | Severity | Artifact | Claim | Concrete risk scenario | Cited evidence |
|---|---|---|---|---|---|
| N-5 | MEDIUM | architecture.md:100 ADR-35; ST-001:142,245,283 | The Stryker command runner with `coverageAnalysis: 'off'` runs the whole vitest suite once per mutant, and the plan sets no incremental mode, no per-story mutate scoping and no job `timeout-minutes`. The blocking mutation job's wall-clock time is therefore unbounded in practice. | ADR-35 itself estimates about 1,800 mutants. Each mutant spawns `npx vitest run --config vitest.stryker.config.ts` (a cold start plus the full unit suite over both majors). At a conservative 6–10 s per run, with `concurrency: 4`, that is roughly 45–75 min, and the S-07 merge gate grows as the S-04..S-06 suites land. Timed-out mutants (`timeoutMS: 60000`) under a loaded runner are counted as detected, which inflates the score. Every story's merge gate (for example ST-003:181, "npm run mutation") then waits about an hour or more per iteration, and the construction fix loops stall. Fix: enable `incremental: true` with a cached `reports/stryker-incremental.json`, scope the per-story gates with `--mutate` to the story's `src/<area>/**`, and set `timeout-minutes` on the CI job. Optionally, point the command at `vitest related`. | grep `timeout-minutes\|incremental` stories/ returns nothing; ADR-35 text "about 1,800 mutants" |
| N-6 | LOW | architecture.md:101 ADR-36; ST-001:242,289 | `npm i --no-save @types/express@4.17.25` over a v5-typed root tree leaves `@types/express-serve-static-core@5` hoisted, and v4's `^4.17.33` is nested under `@types/express`. Any other dev type package that resolves `express-serve-static-core` from the root (for example `@types/supertest` → `@types/superagent` does not, but `@types/serve-static@1` → `@types/express-serve-static-core` may hoist-resolve) can see v5 types in the v4 cell. | In the `express: 4` cell, `tsc -p tsconfig.v4.json` could report spurious `Request`/`Router` incompatibilities between the v4 `@types/express` and a v5 `express-serve-static-core` reached through another package, and the cell fails for tooling reasons. Fix: in the v4 cell, also `--no-save` install `@types/express-serve-static-core@^4.17.33`, or add an `npm ls @types/express-serve-static-core` assertion to the install step. This is LOW because it is detectable on the first CI run and cheap to fix. | Probe: @types/express@4.17.25 deps; ST-001:242,289 install only `@types/express@4.17.25` |

Checks with no finding:
- ADR-40: an esbuild `onResolve` returning `{external:true}` keeps `import "./auto-record.js"` in ESM and `require("./auto-record.cjs")` in CJS output. With `splitting:false`, the duplicated recorder code is guarded by `Symbol.for` (ADR-43). `dts:true` goes through tsup's separate dts pass and is unaffected by the plugin.
- ADR-34: `freshExpress` uses `require` and `require.cache` directly, which works for externalised CJS. `restore` puts the saved entries back.
- ADR-47: the floor was verified empirically, as above.
- ADR-48: the `./package.json` export is trivially feasible.
- ADR-32, 33, 37, 38, 39, 41, 42, 44: these are test and API wiring only, with no new tooling.

## Resolution log

| # | Resolution |
|---|---|
| F-1..F-6 | resolved (see table) |
| F-7 | n/a (informational) |
| N-1 | resolved — ADR-40, ST-001 |
| N-2 | resolved — ADR-40, ST-001 |
| N-3 | resolved — ADR-45, ST-001 |
| N-4 | resolved — ADR-46, ST-001 |
| N-5 | open |
| N-6 | open |
