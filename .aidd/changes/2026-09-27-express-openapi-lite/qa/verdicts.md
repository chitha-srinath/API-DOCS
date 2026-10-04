# QA Step 3 — Adversarial Verification Verdicts

One Adversarial Verifier per CRITICAL/HIGH finding from `qa/findings.md` (4 findings, within cap 6).

## F-01 (CRITICAL) — dangling `$ref` for `.meta({id})`-tagged Zod schemas

**Verdict: CONFIRMED — and the defect is WORSE than originally scoped.**

Traced `src/spec/build.ts`'s `pathParameters`/`queryParameters` (lines 107-131): both extract only `schema?.properties?.[name]` and drop any sibling `$defs`. Root cause confirmed at the adapter level: Zod v4's `z.toJSONSchema` and its Standard Schema `~standard.jsonSchema` implementation both lift `.meta({id})`-tagged subschemas into a `$defs` bag with a `$ref` in their place.

**Critical addition:** the reviewer's finding characterized this as reachable via the opt-in `express-api-contract/zod` subpath. The verifier proved it is also reachable through the **default** `standardSchemaAdapter` path (ADR-21's zero-config default, `src/serve/router.ts:52`) — no opt-in required. End-to-end reproduction (built dist, real HTTP `GET /openapi.json`, `OpenApiParser.validate()`) failed identically for both `{ schemaAdapter: zodAdapter }` and `{}` (default):
```
VALIDATION FAILED: Missing $ref pointer "#/$defs/UserId". Token "$defs" does not exist.
```
No upstream guard (config validation, route registration, adapter duck-typing) intercepts `.meta()`-tagged schemas.

**Disposition: BLOCKING. Enters the step 6 fix loop, scope=ARCHITECTURE-adjacent (spec builder's `$ref` handling needs to merge/hoist `$defs` into `components.schemas`, likely affecting `src/spec/build.ts` and possibly `src/spec/canonical.ts`'s dedup logic).**

## F-02 (HIGH) — glob `escapeChar` shared-`lastIndex` bug

**Verdict: CONFIRMED, exactly as described.**

`src/spec/glob.ts:5-9`'s module-level `/g`-flagged `REGEXP_METACHARS` constant is reused across every `escapeChar()` call with no `lastIndex` reset. Reproduced: pattern `/a..b` compiles to `^\/a\..b$` — first `.` escaped, second left as a live regex wildcard. A second pattern (`a???b`) confirmed the same alternating escape/no-escape signature. No guards found anywhere in the 43-line file.

**Disposition: BLOCKING. Enters the step 6 fix loop (owned by ST-006/S-06's `src/spec/glob.ts`).**

**Post-verdict update (QA step 5, boundary-edge exhaustive testing, `qa/tests/boundary-edge.md`):** independent blind testing (designed without knowledge of this finding) reproduced the mismatch (TC-EDGE-005, TC-EDGE-020) AND found a THIRD aspect the original finding did not identify: **TC-EDGE-010** shows a pattern containing one of every metacharacter in balanced arrangement makes `toRegExp` construct a syntactically invalid regex, throwing `SyntaxError: Invalid regular expression ... Unterminated character class` uncaught. This is a crash/DoS-adjacent path, not merely a silent mismatch — any code path passing user-influenced `include`/`exclude` glob patterns can crash spec generation entirely. **The step 6 fix loop dispatch for F-02 must verify both the escape-alternation mismatch AND the crash case before F-02 is closed** — the suggested fix (drop the `g` flag from `REGEXP_METACHARS`) should address both, but this must be confirmed, not assumed.

## F-03 (HIGH as framed) — O(n²) introspection walk breaching ADR-26

**Verdict: REFUTED at HIGH / "breaches ADR-26" framing. Underlying mechanism confirmed real, demoted to LOW/advisory.**

The verifier confirmed the structural fact: `findByHandle` (`src/registry/registry.ts:22-25`) is an unindexed O(n) `Array.find`, called once per route (not per arbitrary layer, correcting a smaller imprecision in the original framing). That much is a genuine, unmitigated code fact.

But the finding's two load-bearing claims did not survive reproduction:
1. **ADR-26's budget doesn't apply here.** `architecture.md:303-305` and `test/perf/spec-endpoint.perf.test.ts` (literally titled "perf: spec endpoint (warm cache)") show the 200ms p95 gate governs warm-cache steady-state request latency, not a cold introspection/rebuild walk. Applying that budget to this path is a misreading of the ADR, not a violation of it.
2. **Magnitude and growth shape don't reproduce.** Five-trial reproduction with a fresh `createApiDocs()` instance per N (genuinely cold cache): N=500→20.92ms, N=1000→36.48ms, N=2000→76.34ms, N=4000→154.06ms. Growth multipliers (~1.74×, ~2.09×, ~2.02× as N doubles) are consistent with **linear**, not quadratic, growth — a true O(n²) term would show ~4× per doubling. The claimed N=2000 time (252.46ms) did not reproduce; actual measured was 76.34ms, comfortably under 200ms even if the budget did apply.

**Disposition: NOT BLOCKING as a HIGH finding. The O(n) lookup is real and architecturally worth indexing (a Map keyed by handler function would make it O(1)), but at measured/reproducible cost it is LOW/advisory — folded into the advisory list alongside performance finding #3 (a structurally similar unindexed-scan pattern the original reviewer already rated LOW for the same reason: real but not currently consequential).**

## F-04 (HIGH) — `memoizeAdapter` never wired in (dead code)

**Verdict: CONFIRMED.**

Independent `grep -rn "memoizeAdapter" src/` confirms the only match is the export declaration itself (`src/adapter/memo.ts:14`) — no import anywhere else in `src/**`. Both composition-root call sites (`src/serve/router.ts:50-52`, `src/route/typed.ts:61-68`, `resolveAdapter`) resolve and use the raw, unwrapped adapter. Checked for a compensating mechanism: `src/spec/cache.ts`'s document-level cache only covers the `ctx.app` branch of `getSpec()` and caches the whole built document by router fingerprint — it does not cache per-schema JSON Schema conversions, and the no-`ctx.app` branch (`specOperationsFromRegistry`) has no caching at all. No alternate design compensates; the ADR-03 memoization guarantee genuinely does not reach the running package.

**Disposition: BLOCKING. Enters the step 6 fix loop (owned by ST-006/ST-007's composition-root wiring — likely a small, surgical fix: wrap the resolved adapter in `memoizeAdapter` at both call sites).**

## Master Agent cross-check (review-batch monitoring, run in parallel)

Independently traced F-01/F-02/F-03/F-04 and F-06 against source before the adversarial verifiers' own verdicts landed; found no inflated/deflated severities and no missed guards in the *reviewers'* original findings, and confirmed `qa/findings.md` faithfully transcribes each source dimension's file:line/severity/claim. Its acceptance of F-03's underlying mechanism as "confirmed" is not in tension with the adversarial verifier's refutation of the *severity/budget framing* — the two roles checked different questions (citation accuracy vs. whether the claimed impact holds under reproduction), and both are folded into this verdict.

## Summary

| Finding | Severity (final) | Verdict | Disposition |
|---|---|---|---|
| F-01 | CRITICAL | CONFIRMED (scope widened: reachable via default adapter too) | FIXED, step 6 iteration 1 |
| F-02 | HIGH (widened: also a crash path) | CONFIRMED | FIXED, step 6 iteration 1 |
| F-03 | LOW (demoted from HIGH) | REFUTED at HIGH, real mechanism at LOW | Advisory, not blocking |
| F-04 | HIGH | CONFIRMED | FIXED, step 6 iteration 1 (both call sites) |
| F-21 | LOW (new, from exhaustive testing) | — | Advisory, not blocking |

## Fix Loop Iteration 1 — closure evidence

All 3 blocking findings fixed with TDD red-then-green evidence (see each story's "Fix Loop Iteration 1 Report" section) and independently re-verified by the orchestrator:

- **Full suite**: 79/79 files, 639/644 tests (5 legitimate skips), 0 type errors, coverage 98.54/93.04/99.45/99.33 (up from pre-fix).
- **F-01/F-02 mutation gate** (ST-006, `src/spec/**`): 86.96% overall, `src/spec` 84.43%, `build.ts` (F-01's fix) 82.46%, `glob.ts` (F-02's fix) 100% — threshold 70 met.
- **F-04 mutation gate, ST-004** (`src/route/typed.ts`, `src/registry/**`): 86.51% overall, `typed.ts` (F-04's fix location) 71.43%, `registry.ts` 95.45% — threshold 70 met.
- **F-04 mutation gate, ST-007** (`src/docs/**`, `src/serve/**`, entries): 86.54% overall, `router.ts` (F-04's fix location) 100% — threshold 70 met.

**All three mutation gates pass. All three findings' TDD fixes are independently re-verified.**

## Step 6 closure re-check (per-dimension, scoped to each fix)

Per the playbook's step 6 requirement to "re-run ONLY affected reviewer dimensions and test categories": the correctness, performance, and spec-compliance reviewers each re-reviewed their own original finding against the fixed code.

- **F-02 (correctness):** CLOSED. `REGEXP_METACHARS` confirmed to have no `/g` flag; both the escape-alternation bug and the crash path are eliminated by the same one-line fix. `test/spec/glob.test.ts` + `test/aidd-exhaustive/boundary-edge/...` re-run: 2 files, 59 tests, all pass.
- **F-04 (performance):** CLOSED. Both composition-root call sites (`src/route/typed.ts`, `src/serve/router.ts`) confirmed to wrap the resolved adapter in `memoizeAdapter` by direct code read. Memoization empirically confirmed via `test/serve/adapter-memo.test.ts` (spy adapter invoked exactly once across 3 rebuilds). No new performance regression: `memoizeAdapter`'s overhead is O(1) per call (one WeakMap lookup), negligible against the schema-derivation cost it replaces.
- **F-01 (spec-compliance):** CLOSED for `params`/`query` at first, with one new finding surfaced. `hoistSchemaDefs`/`rewriteDefsRefs` confirmed correctly wired for both `pathParameters` and `queryParameters`, working on both the default `standardSchemaAdapter` and the opt-in `zodAdapter` (independently reproduced via a throwaway probe, not just the test file). Same-schema-reuse across multiple operations confirmed to produce a single entry, no duplication. **New finding (F-22, MEDIUM):** two *different* schemas sharing the same `.meta({id})` name collided silently (first-writer-wins, semantically wrong but structurally valid docs) — logged and fixed (see below), not part of F-01's original scope.

**Post-closure widening (found by re-running the api-contract exhaustive test suite, TC-CONTRACT-019/020, after the fixes above):** the original F-01 finding and its fix covered `pathParameters`/`queryParameters` only. `requestBodyOf`/`responsesOf` have the exact same dangling-`$ref` defect — the original finding's own text asserted these were "NOT affected, because they pass the whole adapter output (including its `$defs`) through untouched," but that assumption is wrong: a `$ref` of the form `#/$defs/X` resolves relative to the *whole OpenAPI document*, not to wherever the `$defs` sibling happens to be nested, so embedding an un-hoisted `$defs` bag inline inside a `requestBody`/`response` schema is exactly as broken as the params/query case, not self-contained. **Fixed in the same iteration**: `requestBodyOf` and `responsesOf` now call `hoistSchemaDefs` too, threaded through the same shared `defs` collector already passed to `buildOperation`.

**A second, related issue surfaced and fixed while extending the fix**: the same named schema reused for both a request body (`io: 'input'`) and a response (`io: 'output'`) — an ordinary, common pattern — produces genuinely different JSON Schema output from Zod (`additionalProperties: false` is added for `'output'` but not `'input'`), which the F-22 collision guard's naive JSON-equality check flagged as a false-positive "different schemas" collision. Fixed by normalizing away `additionalProperties` differences specifically (a known, narrow, adapter-driven io-direction variance) before comparing, while still correctly detecting genuine collisions (schemas that differ in type/properties, which `additionalProperties`-stripping does not mask).

**Final closure evidence (fix loop iteration 2):** api-contract exhaustive suite re-run: **28/28 PASS** (was 26/28 with the two expected F-01 failures). Full suite: 79/79 files, 644/649 tests. ST-006's mutation gate re-run a third time (after the requestBody/response widening): **86.18% overall, `build.ts` 82.08%** — threshold 70 met. 3 new regression tests added covering requestBody hoisting, response hoisting, and the same-schema-both-directions case. **F-01 is now genuinely and fully closed** across all four schema positions (params, query, body, response).

## F-22 (MEDIUM) — found and fixed in the same iteration

`hoistSchemaDefs` (`src/spec/build.ts`) now compares colliding `$defs` entries by content: the benign case (the same named schema reused across many routes) stays a silent no-op; a genuine mismatch throws a clear error naming the colliding id, rather than silently producing a route documented with the wrong type. Two new regression tests added (`test/spec/defs-hoist.test.ts`). Full suite re-verified: 79/79 files, 641/646 tests, coverage 98.54/93.25/99.45/99.33. Mutation re-verification in progress.

A cross-cutting infra gap was found and fixed along the way: `vitest.stryker.config.ts` was missing an exclude for the new `test/aidd-exhaustive/performance-smoke/**` suite and a `testTimeout` override, blocking every mutation re-run regardless of the actual fix — independently reproduced by 2 of 3 fix-loop builders with zero concurrent load, confirming it as real and not environmental noise.
