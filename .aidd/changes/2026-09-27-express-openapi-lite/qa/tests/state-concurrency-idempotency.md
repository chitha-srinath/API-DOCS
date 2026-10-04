# QA Test Report — state-concurrency-idempotency

Test Engineer, category: state-concurrency-idempotency (Wave B). Design+execute combined (one-shot).

Test file: `test/aidd-exhaustive/state-concurrency-idempotency/concurrency.test.ts` — 16 executed cases (TC-CONC-001..042).

**Tally: 16 designed / 16 passed / 0 failed / 0 blocked.**

Coverage: 50 concurrent `GET /openapi.json` calls return byte-identical bodies (AC-034); `invalidate()` interleaved among 20 concurrent GETs produces no corrupted/partial document; `createSpecCache.get()`'s synchronous-no-interleaving-window claim (from `qa/findings-performance.md`) independently reconfirmed by direct unit probe; double-registration behavior at both the registry layer (no dedup — two distinct entries) and the spec-build layer (`dedupe()` keeps the first, silently drops later duplicates — see finding below); 25 sub-routers mounted in rapid synchronous succession all discoverable; `installRecorder()` invoked concurrently doesn't double-wrap `use()`; the same `Router` instance mounted at two paths doesn't cross-contaminate; 8 cycles of add-route→invalidate→concurrent-burst produces a final spec with all 8 routes exactly once; 200 simultaneous GETs against a 30-route app all succeed, byte-identical, no crash.

## Finding (new, LOW/advisory — added to `qa/findings.md` as F-21)

**`RouteRegistry.register()` has no dedup** (`src/registry/registry.ts:11-16`): calling `route()`/`describe()` twice for the same method+path always creates two independent registry entries. The actual idempotency guarantee lives entirely in `buildSpec`'s `dedupe()` (`src/spec/build.ts:55-72`): same-rank ties (typed-vs-typed, describe-vs-describe) are broken by lowest-registration-id-wins — the *first* call always wins, the later one is silently discarded with no warning. AC-031 is satisfied (exactly one operation per method+path), but there's no AC or diagnostic covering "a developer registered the same route twice by mistake" — it fails silently rather than surfacing an `EAD_*`-style warning. Not scored as a FAIL since no AC is violated; flagged for awareness, LOW/advisory severity.

No FAIL defects. One self-caught test-authoring bug (a missing router mount in the test's own setup) was fixed during execution, not shipped as a false PASS.

Not re-litigated: F-01, F-02, F-04.
