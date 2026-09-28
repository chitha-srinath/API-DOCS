# QA Test Report — performance-smoke

Test Engineer, category: performance-smoke. Design+execute combined (one-shot; design debate deferred).

Scope: distinct from F-03 (cold-path O(n²) walk, demoted LOW) and F-04 (dead memoizeAdapter, HIGH, in the fix loop) — this category confirms the WARM-cache ADR-26 budget genuinely holds, checks for a memory leak across repeated rebuilds, and soak-tests the introspection walker for latency degradation.

Test files: `test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts` + dedicated `vitest.perf-smoke.config.ts`.

**Tally: 7 designed / 7 passed / 0 failed.**

- **TC-PERF-001/002/007 (WARM budget at 500/1000/2000 routes):** all PASS, p95 well under 200ms at every scale (19-25ms at N=2000, the same N where F-03's cold path clocked 252ms — this is deliberate corroborating evidence that F-03's demotion to LOW was correct: the WARM path the ADR-26 budget actually targets does not share the cold-path's cost).
- **TC-PERF-003 (memory-leak smoke, 200 forced rebuilds at 300 routes):** PASS in isolation with `--expose-gc` (delta -0.18MB to -1.15MB across runs, net negative — no leak). **Orchestrator note:** this test's bound is only meaningful when `global.gc()` actually runs; the main `npm test` script doesn't set `--expose-gc`, so a first full-suite run flaked at 55MB (uncollected allocator noise across a busy 70+-file worker, not a leak — reproduced clean in isolation). Fixed by the orchestrator: the assertion now relaxes to a much wider bound when GC isn't exposed, with an explicit code comment, rather than silently skipping or flaking.
- **TC-PERF-004/005 (introspection soak, 500/1000 routes × 20-30 repeated cycles):** PASS, no degradation trend (last-5 average is flat or slightly faster than first-5 in both runs — JIT warm-up noise, not a regression).
- **TC-PERF-006 (harness sanity):** PASS, `BUDGET_MS` constant matches ADR-26's 200ms.

No new performance defects found. Not re-litigated: F-03, F-04 (already filed).
