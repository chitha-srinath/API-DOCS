# Monitoring Report — Construction Wave 4 (ST-005 Introspection)

## Scope
Builder Report appended to `stories/ST-005-introspection.md` (status: built, attempts: 1).

## Headline claims vs. evidence

- **273 tests passing**: `npm test` transcript shows `Tests 273 passed | 5 skipped (278)`, exit 0. Matches claim. Consistent with the earlier `npx vitest run test/introspect test/describe --no-coverage` sub-run (60 passed/3 skipped) being a subset.
- **G-S05 green on both Express majors**: spike RED (`Cannot find module`) then GREEN (`2 passed`) transcripts are both present and plausible (module-not-found → pass after implementing sniff/paths/recorder/index). The story's Order-of-work instruction (fixtures+contract test first, RED, then implement) is followed in the reported sequence. Accepted.
- **100% mutation score**: Stryker transcript shows `All files 100.00 | 100.00 | 402 | 2 | 0 | 0 | 0` and "Final mutation score of 100.00 is greater than or equal to break threshold 70," with 2 timeouts counted as killed (per-file breakdown for introspect/*.ts and route/describe.ts all 100/100). This is real, independently checkable evidence, not a bare assertion — accepted, and it materially corroborates the coverage discussion below.
- **Two bugs found/fixed mid-TDD**: verified directly in source (see below) — both are real, not just claimed.

## Item 1 — `describe()` signature divergence: same class as ADR-54, NOT a non-issue

Read `architecture.md` C4 (verbatim): *"`route/describe.ts`: `describe(meta)` returns a pass-through middleware tagged with `[META]`, `source: 'describe'`."* This is the same kind of normative, single-call-shape public-API text that architecture.md carried for `route()` before ADR-54 was needed (see `cost/ledger.md:91`, `state.yaml:209`, `supervision/audit.log:106-110`: wave-3 monitor flagged route()'s 4-arg factory shape as diverging from the documented public API, triggering an architect backflow ADR that *ratified* the actual signature as the real public API, and reopened G2 for re-approval).

Grep across ST-004, ST-006, ST-007-serve-docs and coupling-risk.md for `describe(` / `createDescribe` / `DescribeFn` turns up **zero** references to describe()'s call arity from any downstream story — every downstream mention (CR-15 in `pre-review/coupling-risk.md:17`) is scoped to the `[META]` tag shape and `source: 'describe'`, exactly as the builder claims. So the builder's narrow claim (no *downstream-story* coupling to the arg list) is accurate.

But that is the wrong test. ADR-54 was not about internal story coupling either — the wave-3 monitor's concern (and the architect's backflow) was that architecture.md's C4-equivalent text is the documented **public API contract** for package consumers, and the shipped code diverges from it. Here the divergence is larger than route()'s: architecture.md documents `describe(meta)` as a single-argument call; the shipped API is `createDescribe({ registry })` returning `describe(method, localPath, meta)` — a factory plus a 3-arg function. A package consumer following the README/architecture.md text would call `describe(meta)` and get a type error (missing `method`/`localPath`). This is a real, user-facing contract break, not a documentation nicety.

**Verdict: this is the same category of divergence that required ADR-54, and the builder's "no blocker" framing addresses only half the concern (downstream story coupling) while eliding the public-API-conformance half (which is exactly what triggered ADR-54 for route()).** G2 approval and README.md examples (owned by S-08, `test/docs/readme-table.test.ts` per C11) will also need to reflect the real signature, same as ADR-54 required for route().

## Item 2 — Branch coverage exactly at 90.13%: evidence supports genuine coverage, not gaming

The floor is 90%; branches landed at 90.13% (329/365), the tightest of the four metrics reported (statements 97.62%, functions 97.5%, lines 98.61%). A number this close to a threshold is inherently suspicious and the report is right to flag it for scrutiny.

Corroborating evidence against "shallow coverage-chasing":
- The Stryker mutation run — a much stronger signal than line/branch coverage, since it requires each surviving branch/condition to actually change observable behavior when mutated — reports **100.00% mutation score across all of `src/introspect/**` and `src/route/describe.ts`** with 0 survived mutants out of 402 (2 no-coverage counted, 2 timeouts counted killed). If the branch tests added to close the coverage gap were shallow (e.g., asserting only "does not throw" without checking outputs), Stryker's conditional-boundary and logical-operator mutants in the same files would very likely have survived. They did not.
- The two self-reported bugs (below) were found specifically via targeted branch tests going green when they should have failed (`recorder-mismatch.test.ts` catching the `typeof` bug), which is direct evidence the added tests exercise real logic paths, not placeholders.
- The warn/skip test files (`warn.test.ts`, `paths.test.ts`) map 1:1 onto ADR-19/AC-034's enumerated cases (registry-entry-missing, unrecognised layer, unrecoverable mount, mounted_app-without-CHILD, throwing layer; RegExp skip, unnamed `*` skip) — these are the story's own listed branches, not invented filler.

**Verdict: the 90.13% figure is credible as genuine coverage of real branches**, corroborated by the independent 100% mutation score in the same file set, which would be very hard to fake with shallow tests. No coverage-gaming red flags found.

## Independent spot-check — the two self-reported bugs

**Bug 1 (Express 4 `app.router` throws, ADR-27a).** Read `src/introspect/sniff.ts`: `isExpress4()` checks `hasOwnProperty(app, '_router') || typeof app.lazyrouter === 'function'` (key-only, matches ADR-27's pinned seam verbatim) and `sniffRoot()`'s v4 branch returns `app._router` after calling `lazyrouter()`, **never reading `app.router`**. The v5 branch is the only one that reads `app.router`. This is a correct, direct implementation of ADR-27a's "never reads `app.router` on v4" rule — confirmed real, not just claimed.

**Bug 2 (`recorderInstalled` typeof guard, ADR-34).** Read `src/introspect/index.ts:220-226`:
```
// Router instances are callable (typeof 'function'), not plain objects —
// guard on nullishness only, not `typeof === 'object'`.
const recorderInstalled =
  root != null && (typeof root === 'object' || typeof root === 'function')
    ? isRecorderInstalled(root as object)
    : true;
```
This matches the builder's narrative exactly: the current code checks both `'object'` and `'function'` and is guarded on nullishness first, consistent with a fix from a prior `typeof root === 'object'`-only check that would have skipped Router instances (which are callable functions) and defaulted `recorderInstalled` to `true`, masking `EAD_RECORDER_NOT_INSTALLED`. `isRecorderInstalled()` in `recorder.ts` (prototype-chain walk for `RECORDER`, `hasOwnProperty`) matches ADR-34/ADR-23's described detection. Confirmed real and correctly fixed.

## Recommendation

Proceed with the wave (tests, mutation, gate evidence are all genuine and well-cited), but **do not accept the builder's "no blocker" framing on `describe()` as final**: this needs the same backflow-ADR treatment ST-004's `route()` got — an architect pass to either (a) ratify `createDescribe({registry}) → describe(method, localPath, meta)` as the real public API and correct architecture.md's C4 text, or (b) require a `describe(meta)`-shaped wrapper if the single-arg call is load-bearing for consumers/README. Until that ADR lands, G2 should be treated as stale for the same reason it was after ADR-54, and S-08 (README/docs, C11) should not be dispatched against the current C4 text.

## Summary for handback

1. Evidence for 273 tests, G-S05 both-majors green, and 100% mutation score is genuine, checkable, and accepted.
2. Both self-reported bugs verified directly against source: `sniff.ts` never reads `app.router` on v4 (ADR-27a); `index.ts`'s `recorderInstalled` check now guards on nullishness plus `function` (ADR-34) — both real fixes.
3. Branch coverage at 90.13% is credible as genuine, not gamed — corroborated by the 100% mutation score in the same files, and the added tests map onto the story's own enumerated branch list.
4. `describe()`'s shipped shape (`createDescribe({registry})` returning a 3-arg `describe(method, localPath, meta)`) diverges from architecture.md C4's documented `describe(meta)` public API — same category of divergence that produced ADR-54 for `route()`; the builder's "downstream stories don't depend on the arg list" claim is true but answers the wrong question (public-API conformance, not story coupling).
5. **Recommendation: needs a backflow ADR, same as ST-004** — flag to the architect/orchestrator before G2 re-approval or S-08 dispatch; do not treat this as a non-issue.
