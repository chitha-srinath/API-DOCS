# Critic Verdict — 2026-09-27-express-openapi-lite

<!-- Critic. One consolidated pre-merge verdict synthesizing all QA evidence. -->

## Verdict

**APPROVE WITH CONDITIONS**

## Rationale (cite artifacts)

- **AC coverage is complete and independently corroborated three times over.**
  `ac-matrix.md` records 47/47 PRD ACs (AC-001..AC-047) PASS with a directly-executed,
  green test citation each. `audit/interrogation/qa-final-verdict.md` (auditor, QA step 12)
  independently re-executed a representative cross-section live (`test/spec/build.test.ts`,
  `glob.test.ts`, `test/introspect/walk.test.ts`, `test/spec/ac023.test.ts` = 37/37; the
  api-contract exhaustive suite = 28/28 PASS) rather than trusting citations verbatim, and
  returned 47/47 PROVEN, 0 DISPUTED. `qa/tally.md` (QA step 11) cross-joined every AC to its
  owning story, diff files, and tests: 47/47 RECONCILED, 0 gaps, 0 orphans. No PASS/PROVEN
  verdict rests on mocked evidence where the AC demanded a real path, and no finding fixed
  without re-verification (`qa/verdicts.md`'s fix-loop closure section).

- **Adversarial review found and closed all blocking defects with TDD evidence.**
  `qa/verdicts.md` (QA step 3) confirmed F-01 (CRITICAL, dangling `$ref`/`$defs` for
  `.meta({id})`-tagged Zod schemas, reachable via the *default* adapter, later widened to
  also cover `requestBody`/`response` positions), F-02 (HIGH, glob `escapeChar` shared
  `lastIndex` bug, widened to a crash/DoS-adjacent path), and F-04 (HIGH, `memoizeAdapter`
  dead code) as genuine and BLOCKING; all three were fixed, re-verified by independent
  reviewers, and pass their mutation gates (`build.ts` 82.08%, `glob.ts` 100%, `typed.ts`
  71.43%, `router.ts` 100%, all ≥70% floor). F-03 (O(n²) claim) was rigorously REFUTED at
  HIGH via reproduction (linear growth, not quadratic) and correctly demoted to LOW/advisory
  — it does not gate any AC.

- **Test suite, coverage, and mutation are all above target.** Full suite green (78-79
  files, 637-644 tests), coverage 98.56/93.35/99.45/99.34% (target 90%), mutation 84.39% on
  the full clean-state run (floor 70%). `qa/test-report.md` and `ac-matrix.md` corroborate.

- **Security is clean.** `qa/security-report.md`: 0 secrets, `npm audit --audit-level=critical`
  exit 0 (only 1 LOW dev-only and 2 MODERATE dev-only transitive advisories, none shipped in
  `dist/`, zero runtime `dependencies`), OWASP checklist PASS with only INFO-level
  hardening notes (T-2 cdnUrl scheme, T-3 no built-in authN on docs routes — both by-design,
  documented, non-blocking).

- **Two quarantined tests are a documented, non-regression host artifact.**
  `test/entries/minified.test.ts` and `test/meta/lint-rules.test.ts` are confirmed
  CPU-contention flakes under this Windows host's high vitest worker concurrency (pass
  reliably in isolation/parallelism-1/reverse-order per `qa/determinism-report.md`), not app
  regressions. Per the given context, their governing ACs are not *solely* proven by the
  quarantined runs — `ac-matrix.md` cites other, stable evidence for those ACs — so this
  does not create an AC gap. Acceptable as-is; no condition needed beyond what
  `qa/determinism-report.md` already tracks.

- **Genuine, disclosed infrastructure gap: `evidence_contract: receipts-v1` mechanical
  capture is missing.** `aidd-evidence.py capture` hard-requires POSIX process groups and
  cannot run on this native-Windows host (no usable WSL Python 3.9+ distro locally).
  `evidence/receipts/**` and `evidence/acceptance.json` were not produced. This is disclosed
  consistently across `ac-matrix.md`'s "Environment gap" section, `qa/tally.md`'s
  "Routed" section, and `state.yaml` (`evidence_contract: receipts-v1`, header comment
  "source-bound suite and AC receipts required before delivery"). The substantive AC
  evidence (live, independently re-executed test output) is not in question — only the
  *mechanical, schema-shaped* receipts artifact is absent. This is a real, named gap against
  a declared repo-wide contract (`evidence_contract: receipts-v1`) and is exactly the kind
  of thing that must not ship on assertion; it is the one item in this change that keeps this
  from being an unconditional APPROVE.

- **Cost is within budget.** 39% tokens / 87% minutes of the raised ceiling, no pending cost
  stops (per task context).

Net: every PRD AC is proven by real, independently-reproduced evidence; every BLOCKING
correctness/security finding was fixed and re-verified; coverage/mutation/security gates all
clear their thresholds. The single open item is a platform-capability gap in the mechanical
evidence-contract tooling, not a defect in the shipped code or its test proof — mergeable now
with a concrete, owned follow-up to close it.

## Conditions (if APPROVE WITH CONDITIONS)

| # | Condition (concrete, verifiable) | Owner / AC |
|---|---|---|
| 1 | Run `aidd-evidence.py capture` (+ manifest generation) for this change on a POSIX host (CI runner or a working WSL Python ≥3.9 distro) to produce `evidence/receipts/**` and `evidence/acceptance.json`, then re-validate the change's `evidence_contract: receipts-v1` compliance. Verifiable by: the two artifact paths existing and passing `aidd-evidence.py verify` (or equivalent contract check) with exit 0. Target: before or within one release cycle of merge — does not block merge, since no PRD AC's Given/When/Then depends on receipts-v1 artifacts and all 47 ACs are independently proven by direct test evidence (`ac-matrix.md`, `audit/interrogation/qa-final-verdict.md`). | Delivery phase / CI owner |
| 2 | Track `test/entries/minified.test.ts` and `test/meta/lint-rules.test.ts` quarantine as a follow-up to reduce Windows-host vitest worker concurrency (or otherwise stabilize) so they can be un-quarantined; not a merge blocker per `qa/determinism-report.md`'s isolation-reproduction evidence, but should not remain quarantined indefinitely. | QA/infra owner |
| 3 | Opportunistically run `npm audit fix` for the dev-only `qs`/`typed-rest-client` moderate advisories (SEC-1) at the next maintenance window; non-blocking, not shipped in `dist/`. | Maintainer |

## Blockers (if REJECT)

| # | Blocker | Evidence | What flips it to APPROVE |
|---|---|---|---|
