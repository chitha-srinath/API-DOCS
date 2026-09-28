# Auditor Verdict — ST-006 (Wave 5)

Subject: Builder Report appended to `stories/ST-006-spec-builder.md`.
Rounds used: 0 of 2 (all ACs settled in round 0 direct interrogation — no challenge issued).

## Independent reproduction performed

- `npx vitest run test/spec` re-run live: **6 Test Files passed (6), 35 Tests passed (35), Type Errors: no errors** — matches the Builder Report's Green block exactly.
- Read `src/spec/build.ts` in full: confirmed purity (no `express`, `zod`, `registry/registry` import), dedupe precedence (`typed:2, describe:2, plain:1`, tie-break by `RegistryEntry.id`/index, never post-sort array position), auto-400 gated on `op.source === 'typed' && hasRequestSchema`, self-exclude of `specPath`/`docsPath`, security inheritance (`meta.security ?? config.security`), info/servers/tags override logic, and final `canonicalize(doc)` call.
- Read `test/spec/ac023.test.ts`, `test/spec/stub-adapter.test.ts`, and the AC-tagged `it(...)` blocks in `test/spec/build.test.ts` / `test/spec/cache.test.ts`: every claimed AC (AC-005, AC-011, AC-015, AC-016, AC-017, AC-023, AC-030–AC-034, AC-038, AC-039, AC-041, AC-042, AC-047) has a named, directly-mapped test asserting the exact Then-clause of the PRD row (e.g. ac023.test.ts asserts `tags` equals `['api']` from the **mounted** path per ADR-32; build.test.ts's AC-034 case asserts id-ordered suffixes, not array position).

## ADR-50 scoped mutation claim — independently reproduced from raw data

Builder claims: `npx stryker run --mutate "src/spec/**" --incremental` → 100.00%, 383/383 tested, 376 killed, 7 timeout, 0 survived, and self-disclosed a prior `tail`-buffering misread that caused a kill-and-rerun.

Verification against the raw incremental report (`reports/stryker-incremental.json`, not the console summary):
```
$ grep -o '"status": *"[A-Za-z]*"' reports/stryker-incremental.json | sort | uniq -c
    376 "status": "Killed"
      7 "status": "Timeout"
```
376 + 7 = 383, 0 Survived (no other status values present) — exact match to the Builder Report's numbers.

```
$ grep -o '"[^"]*\.ts"' reports/stryker-incremental.json | grep -v node_modules | sort -u
"npx vitest run --config vitest.stryker.config.ts"
"src/spec/build.ts"
"src/spec/cache.ts"
"src/spec/canonical.ts"
"src/spec/glob.ts"
"src/spec/naming.ts"
```
Only the 5 `src/spec/**` files are present in the report despite `stryker.config.mjs`'s static `mutate` array covering six packages — confirming the `--mutate "src/spec/**"` CLI scope actually took effect (this is a single coherent scoped run, not a merged/corrupted artifact from the earlier killed attempt). `reports/mutation/mutation.html` and `reports/stryker-incremental.json` share the same mtime (2026-09-28 03:08), consistent with one completed run producing both outputs together, not a stitched-together partial + rerun. No stray `.stryker-tmp` leftovers were found.

Conclusion: the ADR-50 mutation claim is genuine — the self-disclosed process confusion (tail buffering, kill, rerun) does not taint the recorded final numbers; the raw per-mutant status counts in the JSON artifact corroborate the console summary independently.

## Per-AC verdicts

| AC | Verdict | Basis |
|---|---|---|
| AC-005 | PROVEN | `stub-adapter.test.ts` line 19 test, re-run green; stub schema asserted in `requestBody` via `toEqual`. |
| AC-011 | PROVEN | `build.test.ts` AC-011 test; `build.ts` `responsesOf` gates 400 on `source==='typed' && hasRequestSchema`, read directly. |
| AC-015 | PROVEN | Every spec-producing test calls `SwaggerParser.validate`; re-run confirms all pass; `build.ts` sets `openapi: '3.1.0'`. |
| AC-016 | PROVEN | `build.test.ts` AC-016 test asserts path/param/query/requestBody/response shape via `toEqual` against adapter output; re-run green. |
| AC-017 | PROVEN | `build.test.ts` AC-017 test asserts all three schemes present and op security reference. |
| AC-023 | PROVEN | `ac023.test.ts` read in full: asserts exact path, get+post, operationId, path param shape, 200, and `tags === ['api']` (mounted-path tag per ADR-32), across `majors` (Express 4 and 5). |
| AC-030 | PROVEN | `build.test.ts` AC-030 test: `autoDetect:false` and `exclude` cases, typed unaffected. |
| AC-031 | PROVEN | `build.test.ts` AC-031 dedupe test; `dedupe()` in `build.ts` confirmed to rank typed/describe over plain. |
| AC-032 | PROVEN | `cache.test.ts` AC-032 test: route added post-mount triggers re-walk via fingerprint change. |
| AC-033 | PROVEN | `build.test.ts` AC-033 test + `selfExcludePaths` in `build.ts` confirmed to filter both default and custom specPath/docsPath. |
| AC-034 | PROVEN (S-06 scope: byte identity) | `build.test.ts` AC-034 id-ordered-suffix test + `canonical.test.ts` byte-identity test (not individually re-opened line-by-line but covered by the full green re-run and source read of `dedupe`'s id-based ordering, which is the mechanism AC-034 depends on for byte stability). |
| AC-038 | PROVEN | `build.test.ts` AC-038 test: info/servers/tags overrides plus ADR-08 default checked. |
| AC-039 | PROVEN | `build.test.ts` AC-039 test + `securityOf()` in `build.ts` (meta.security wins, else config.security — `[]` is `!== undefined` so route `security: []` is preserved, not treated as absent). |
| AC-041 | PROVEN | `build.test.ts` AC-041 test: `include` filter plus custom `detectedDefaultResponse`; `responsesOf()` branch confirmed in source. |
| AC-042 | PROVEN | `build.test.ts` two AC-042 tests: default naming and custom strategies, explicit-value precedence. |
| AC-047 | PROVEN | `stub-adapter.test.ts` second test: per-route `meta.adapter` overrides the `adapter` parameter, confirmed against `resolveAdapter()` in `build.ts`. |

## Result

16/16 ACs PROVEN. 0 DISPUTED. No challenge round was needed — every AC had cited, executed evidence that was independently reproduced (test re-run) or corroborated against raw artifacts (mutation JSON) and the actual source implementation.
