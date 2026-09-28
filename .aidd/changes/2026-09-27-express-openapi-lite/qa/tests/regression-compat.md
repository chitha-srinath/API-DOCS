# QA Test Report — regression-compat

Test Engineer, category: regression-compat (Wave B). Design+execute combined (one-shot).

Scope framing (greenfield package, first release, no prior published version): regression here means (a) nothing broke beyond what Wave A already reported, (b) Express 4+5/ADR-41 export/semver surface stability holds, (c) zero-config → add-options doesn't regress, (d) full `npm test` has no failures beyond the 3 already-known.

Test file: `test/aidd-exhaustive/regression-compat/aidd_exhaustive_regression.test.ts` (7 new automated cases) plus interpretation of the existing suite (28+ files parametrized over both Express majors).

**Tally: 13 designed / 11 passed / 2 failed (same root cause, both resolved by the orchestrator) / 0 blocked.**

Coverage: zero-config baseline across both Express majors (AC-035/036); adding `specPath`/`docsPath` doesn't break existing plain routes (AC-037/021); a partial global `openapi.info` override leaves siblings and unrelated defaults intact (AC-044a); ADR-41 export-set cross-entry snapshot (AC-002/003); Express 4/5 parity across the whole existing suite (interpreted, AC-023/024/004); dual ESM/CJS load parity, no-zod-load, minified, bundle entries (interpreted, AC-004); dist build-shape/manifest/pack contract (interpreted, AC-002/020); full-suite determinism (ran `npm test` twice, before and after adding new cases — **exactly** TC-EDGE-005/010/020 failing both times, nothing else, confirming no new product regression from Wave A's additions).

## New regression found (2 FAILs, same root cause — RESOLVED)

`npx tsc --noEmit` and `npm run test:v4`'s typecheck step failed with 5 TypeScript errors in a **sibling Wave-B test file**, `test/aidd-exhaustive/state-concurrency-idempotency/concurrency.test.ts` (array-indexing possibly-undefined and `getSpec()`'s return type being `unknown` in a few assertions) — breaking AC-026/027's CI gates. This is exactly the kind of cross-category interference regression-compat testing exists to catch.

**Resolved by the orchestrator:** mechanical fixes (non-null assertions, narrow type casts) applied to `concurrency.test.ts`. Re-verified: `npx tsc --noEmit` exits 0, full suite back to exactly the 3 expected F-02 failures.

## Observational addition (not a FAIL, from the companion state-concurrency-idempotency report)

The registry has no dedup at registration time; `buildSpec`'s `dedupe()` silently keeps the *first* registration and drops later duplicates for the same method+path with no warning. No AC is violated (AC-031's "exactly one operation" holds), but there's no `EAD_*`-style diagnostic for "you registered the same route twice by mistake." Folded into `qa/findings.md` as a new LOW/advisory item (F-21).

Not re-litigated: F-01, F-02, F-04.
