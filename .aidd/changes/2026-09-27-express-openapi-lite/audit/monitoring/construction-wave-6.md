# Construction Wave 6 — Monitoring Report (Master Agent, mode: monitor)

Subject: ST-007 (S-07) Builder Report — serve/docs/entries, dual-package hazard tests, perf gate.

## 1. ADR-55 fix + sibling extensionless-import defect — CONFIRMED, correctly reasoned

- `tsup.config.ts`'s `keepAutoRecordExternal` esbuild plugin filters on
  `onResolve({ filter: /^\.\/auto-record$/ })` — an exact-match regex with no `.js`
  suffix. `src/index.ts` line 4 imports `'./auto-record'` (no extension), which matches
  the filter and is externalized correctly.
- Independently verified against the built artifacts (not just the test): `dist/index.js`
  line 2 is `import "./auto-record.js";` and `grep` of `dist/index.cjs` shows
  `var import_auto_record = require("./auto-record.cjs");` — both external references,
  and `dist/auto-record.js` is a real, non-trivial module (recorder install logic), not
  the `0 B` stub the pre-fix red run reported.
- `package.json`'s `sideEffects` array now has the claimed 3 entries
  (`./dist/auto-record.js`, `./dist/auto-record.cjs`, `src/introspect/auto-record.ts`),
  confirmed by direct read of `package.json`.
- Verdict: the sibling defect (extension mismatch would have silently defeated the
  `sideEffects` fix even after it was applied, since an extension-qualified import
  wouldn't match the plugin's `onResolve` filter and would get inlined instead of kept
  external) is real and correctly diagnosed, not a misdiagnosis. Evidence is checkable
  independent of the builder's own test run.

## 2. ADR-38 adapter fallback chain — CONFIRMED, actually completed here (not still deferred)

- `src/serve/router.ts:50-52` computes
  `options.schemaAdapter ?? standardSchemaAdapter` and passes it as `adapter` into
  `buildFromApp`/`getSpec` → `buildSpec(ops, options, adapter)`. This is exactly the
  "last link" the ST-006 builder left to "the S-07 composition root" per the Wave 5
  monitoring note — `src/spec/build.ts`'s `buildSpec` takes a single pre-resolved
  `adapter` argument and only applies `meta.adapter ?? fallback` per-operation
  (`resolveAdapter` at `spec/build.ts:44-46`); it never had a `standardSchemaAdapter`
  default of its own, so without S-07 injecting it, zero-config `createApiDocs()` would
  never reach `standardSchemaAdapter` for spec generation. Confirmed present and wired.
- Separately, the request-validation half of the chain
  (`meta.adapter ?? globalOptions.schemaAdapter ?? standardSchemaAdapter`) already
  existed in `src/route/typed.ts`'s own `resolveAdapter` (ST-004-owned, pre-existing) —
  this half was never actually deferred; only the spec-builder half was. The Builder
  Report doesn't over-claim credit for the route-validation half; the composition-root
  code change is exactly scoped to the piece that was genuinely missing.
- `route()`'s 4-arg signature (`method, localPath, meta, handler`) and `describe()`'s
  factory shape are both consumed as-is from `route/typed.ts` / `route/describe.ts`
  (`createRoute`, `createDescribe`) without local reimplementation — correct handover,
  no scope violation.

## 3. Recorder installs from the built package — INDEPENDENTLY CONFIRMED via artifact inspection

Per the assignment, this is treated as the single most important claim, so it was
checked without relying on the passing test:
- `dist/index.js` retains `import "./auto-record.js";` as its first statement (verified
  by direct read), and `dist/auto-record.js` is a real ~40+-line module implementing
  `installRecorder`/recorder wiring (verified by direct read) — not stripped, not empty.
- `dist/index.cjs` retains `require("./auto-record.cjs")` (verified by grep).
- Given ES module import-time side effects and CJS `require` both execute top-level
  module code unconditionally, and the retained artifact is the real recorder-install
  module (confirmed non-empty, confirmed contains `installRecorder`/`RECORDER` symbol
  logic), the runtime behaviour the test asserts (RECORDER present on
  `express.Router()`/`express.application` prototypes after load) follows directly from
  the artifact shape, independent of trusting the test's own pass/fail output.
- This corroborates the claim without re-executing the child-process test.

## 4. Perf/bench harness — budgets are real, not decorative

- `test/perf/harness.ts` implements exactly the ADR-26 algorithm as quoted in the
  story: 50 warm-ups, `SAMPLES = 300`, `nearestRankP95` by `Math.ceil(0.95 * n)`,
  `BUDGET_MS = 200` (matches the constitution's stated p95 budget), 3 rounds, fails
  only when `failures >= 2` (the "2 of 3" noise policy). This is a faithful, checkable
  implementation, not a placeholder that always passes — the assertion throws a real
  `Error` with the measured numbers on budget breach.
- `test/perf/spec-endpoint.perf.test.ts` exercises a real in-process Express app built
  through the actual `createApiDocs()`/`route()` composition root, not a mock —
  confirms the gate measures the real code path.
- `bench/spec-endpoint.bench.ts` is correctly marked informational (`vitest bench`,
  not a gate) and mirrors the same setup for trend reporting; consistent with ADR-26's
  "not the gate" language.
- Minor code smell (non-blocking): `assertPerfBudget`'s
  `if (failures < FAILURES_TO_FAIL && round === ROUNDS - 1) break;` is dead code — that
  condition is only ever evaluated on the last loop iteration, where breaking has no
  effect. Harmless (correctness unaffected, all 3 rounds still run), but worth a
  cleanup note; not a defect in the gate's actual behaviour.

## Open item: collateral test/dist/** state is inconsistent with the Builder Report and needs confirmation

The Builder Report (Section 5/9) states `test/dist/build-shape.test.ts`
("does not inline the recorder install call") and `test/dist/pack.test.ts`
("sideEffects matches the auto-record entries") are **currently failing** as expected
collateral, outside `file_scope.owns`, flagged as follow-ups for S-01 — the builder
explicitly states "I did not touch it" for both.

However, reading both files as they stand in the working tree now shows they are
**already fixed**:
- `test/dist/build-shape.test.ts`'s assertion (lines 20-33) already checks the narrow
  call-site string `installRecorder(express, log)` / `autoRecord()`, not the bare
  `installRecorder(` substring the report describes as the false-positive cause, and
  carries a comment explicitly describing this exact false-positive scenario as already
  resolved.
- `test/dist/pack.test.ts` (lines 54-59) already asserts the 3-element `sideEffects`
  array the builder's ADR-55 fix produces.

Since the outer git status shows both files as modified (tracked, unstaged) and this
role has no shell access this session to run `git log`/`git blame` on them, authorship
and timing of that fix could not be independently established. This does not contradict
Sections 1-4 above — the code substance in Sections 1-4 was verified directly against
source/dist, not against the builder's narrative about these two files. But the
Builder Report's own full-suite result ("2 failed | 65 passed (67)") is now stale
relative to the working tree: whoever applied the `test/dist/**` fix, a fresh
`npm test` should be re-run before this wave is treated as fully green, since the
report's evidence for the "2 known/expected failures, nothing else broken" claim no
longer matches what's on disk. Recommend the orchestrator confirm (a) who authored the
`test/dist/**` changes and whether it was in-scope, and (b) a current full-suite run.

## Summary of AC/claim spot-checks

All four assigned scrutiny points check out on direct evidence (source/dist reads, not
just the builder's own test transcripts): the sideEffects+extension fix is real and
correctly reasoned, the ADR-38 fallback chain's missing link is genuinely completed in
`src/serve/router.ts` (not still deferred), the recorder-install claim is corroborated
independently via built-artifact inspection, and the perf harness implements the actual
ADR-26 budget/noise policy rather than a decorative check. The one open item is the
apparent staleness of the Builder Report's full-suite evidence against the current
`test/dist/**` state, which should be reconciled before sign-off.
