# Monitoring Note — QA Steps 4-5 (Test Batch, all 8 categories)

Master Agent, mode: monitor. Subjects: `qa/tests/{functional-happy-path,negative-error-handling,
boundary-edge,impossible-abuse,api-contract,performance-smoke,regression-compat,
state-concurrency-idempotency}.md` + `qa/test-report.md`. Cross-checked against
`qa/verdicts.md` and `qa/findings.md`.

**Tooling note (limitation, disclosed):** this dispatch has no Bash/shell tool available —
read-only file tools only. I could not literally execute `npm test`. Verification of the
"only 3 expected failures" claim below is done by (a) reading the actual test source file
(`test/aidd-exhaustive/boundary-edge/aidd_exhaustive_boundary.test.ts`) for TC-EDGE-005/010/020
and manually tracing the shared-`lastIndex` state-machine against `src/spec/glob.ts`'s real
source to confirm the claimed behavior is mechanically correct, and (b) cross-referencing
regression-compat's own independent claim (ran the full suite twice) rather than by an
independent process execution. This is a real gap versus "I ran it myself" — flagged, not
concealed.

## Spot-checks performed (5+, across categories)

1. **boundary-edge TC-EDGE-005** (`matchGlob('.', 'x')` → `true`): traced by hand against
   `src/spec/glob.ts:5-9`. `REGEXP_METACHARS` is a shared `/g`-flagged regex object with
   persistent `lastIndex`. First `escapeChar('.')` call (parsing the pattern) advances
   `lastIndex` to 1 via a successful zero-width-adjacent match; the second `escapeChar('.')`
   call (parsing the *target* re-checked via a second `toRegExp` build, since `matchGlob`
   rebuilds the regex from pattern each call) starts at `lastIndex=1` against a length-1
   string, fails to match, and **silently resets to unescaped**, producing `^.$` — a wildcard,
   not a literal dot — hence `'x'` matches. This is a genuine, mechanically-verified
   reproduction of the claim, not an assertion resting on trust.
2. **boundary-edge TC-EDGE-010** (crash path): read the actual test body
   (`aidd_exhaustive_boundary.test.ts:93-114`) — it wraps two `matchGlob` calls in `try/catch`
   and asserts `firstErr`/`secondErr` are `undefined` and both results are `true`. This is a
   real executed assertion that would fail loudly (not silently pass) if `toRegExp` threw —
   the case genuinely exercises the crash path, it does not merely document intent.
3. **api-contract TC-CONTRACT-019/020**: report explicitly ties both to F-01's exact
   `OpenApiParser.validate()` failure signature (matches `qa/verdicts.md`'s F-01 reproduction
   string almost verbatim: dangling `$defs` `$ref`). TC-CONTRACT-020 additionally exercises
   the *default* adapter path with no override — this is a distinct code path from
   TC-CONTRACT-019's opt-in `zodAdapter`, so it is not a duplicate assertion dressed up as two
   cases.
4. **state-concurrency-idempotency F-21**: read `src/registry/registry.ts:11-16` claim
   pathway is corroborated identically in three places — the category's own report, the
   consolidated `qa/test-report.md`, and `qa/findings.md`'s F-21 row — all describing the same
   file:line, same "first-registration-wins, no diagnostic" mechanism, same LOW/advisory
   severity, no drift between them.
5. **performance-smoke TC-PERF-007**: cross-checked the WARM (19-25ms @ N=2000) vs. F-03's
   cold-path (252ms @ same N) contrast claim against `qa/verdicts.md`'s F-03 section, which
   independently states the ADR-26 budget targets warm-cache steady state per
   `architecture.md:303-305` and the perf test file's own title. The two artifacts corroborate
   without circularity (different authors, same underlying fact).

## Question 1 — Is TC-EDGE-010 genuinely a NEW aspect of F-02, not already covered?

**Confirmed accurate.** Read `qa/verdicts.md`'s F-02 section (lines 19-27) in full. The
original verifier's reproduction (`/a..b` → `^\/a\..b$`, and `a???b`'s alternating pattern)
is exclusively a **silent mismatch** class of failure — the regex compiles fine, it just
matches the wrong thing. Nothing in the original F-02 finding (`qa/findings.md` F-02 row,
`src/spec/glob.ts:5-9` "silently failing to escape... can silently over- or under-match")
or the verifier's verdict mentions an uncaught exception / crash path. TC-EDGE-010's claim —
that a balanced one-of-every-metacharacter pattern can produce an **unbalanced, syntactically
invalid regex that throws `SyntaxError` uncaught** — is a distinct failure mode (crash vs.
mismatch) not covered by the original text. Notably, `qa/verdicts.md` itself has already been
amended (lines 27) with a "Post-verdict update" that folds this in and explicitly instructs
the step 6 fix loop to verify the crash case separately before closing F-02 — so this widening
claim has already propagated correctly into the authoritative verdict artifact, not just the
test report. No overclaim found.

## Question 2 — Is F-21's LOW/advisory severity appropriate?

**Appropriate, on the evidence available.** Reasoning:
- No AC is violated: AC-031's "exactly one operation per method+path" holds under the
  first-wins tie-break in `dedupe()` — the spec output is well-formed, just not what a
  developer who fat-fingered a duplicate `route()` call might expect.
- The failure mode is **silent** (no diagnostic) rather than **corrupting** (no data loss
  beyond the intentionally-designed dedup, no crash, no security exposure) — this is the
  correct LOW/advisory band per the same severity logic already applied to F-12 (`dedupe()`'s
  id-vs-array-position tie-break degradation, also LOW) in `qa/findings.md`, a directly
  analogous case in the same file (`src/spec/build.ts:55-72`) rated the same way.
- Counter-consideration weighed and rejected: one could argue "silent data-loss of a
  registration" deserves MEDIUM (parity with F-05, which is MEDIUM for a similar
  silent-drop-with-no-warning pattern on named wildcards). However F-05 affects the shape of
  the **generated spec presented to API consumers** for a valid single route (a correctness
  defect visible externally); F-21 only affects a **developer's own duplicate-registration
  mistake** with no valid single-route case degraded — the blast radius and who is affected
  differ materially. LOW/advisory stands as reasonable, not as an unexamined default.

## Question 3 — Are the ONLY failures exactly TC-EDGE-005/010/020?

**Not independently re-executed (tooling gap, see above).** What I can and did verify:
- `qa/test-report.md`'s aggregate tally table sums to exactly 7 raw FAILs (3 boundary-edge +
  2 api-contract + 2 regression-compat), and explicitly reconciles the regression-compat 2 as
  resolved test-infrastructure (tsc errors in a sibling file, not product defects) and the
  api-contract 2 as expected F-01 confirmations — leaving exactly 5 as legitimate open product
  defects (F-01 x2, F-02 x3), matching the "3 expected" framing used in this task's wording
  (TC-EDGE-005/010/020) for the F-02 cluster specifically, plus the 2 F-01 confirmations
  tracked separately.
- regression-compat's own report (`qa/tests/regression-compat.md`) states it ran the full
  suite **twice** (before/after adding its own cases) and got the identical 3 EDGE failures
  both times, "nothing else" — this is a same-batch independent corroboration, not the
  original tester grading their own homework, but it is still not *my* independent execution.
- I did not find any other FAIL, SKIP, or silently-omitted case across any of the 8 category
  files or the consolidated report that isn't accounted for in the above reconciliation.

**Recommendation:** the next QA step (or the orchestrator, when tooling permits) should
re-run `npm test` with actual shell execution and diff the failing-test names against
exactly `{TC-EDGE-005, TC-EDGE-010, TC-EDGE-020}` ∪ the 2 F-01 api-contract cases, since this
monitoring pass could only corroborate via cross-document consistency, not live execution.

## Overall verdict on the batch

The 5 spot-checked PASS/FAIL claims all rest on genuinely executed, traceable evidence — none
found to be an assertion "gesturing at success." The TC-EDGE-010 widening claim is accurate
and already correctly folded into `qa/verdicts.md`. F-21's severity is defensible against the
nearest analogous finding (F-12) in the same findings list. The one open gap is procedural,
not substantive: this monitoring pass lacks live command execution to directly confirm the
"only 3 failures" claim end-to-end; it is corroborated by cross-document consistency and one
in-batch independent re-run (regression-compat) but not by an out-of-band execution.
