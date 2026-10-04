# feat: express-openapi-lite — TypeScript-first OpenAPI docs for Express

## Intent

Build `express-api-contract` (working name express-openapi-lite): a TypeScript-first npm
package that generates OpenAPI 3.1 docs for Express from route definitions with
near-zero config. Zod schemas go through a pluggable `SchemaAdapter` interface (Zod
adapter ships first; other schema libraries additive later without breaking changes).
Required: typed route helper that validates requests and infers handler types;
automatic path/query/body/response/params docs; security schemes declared once; a docs
UI endpoint; a JSON spec endpoint; incremental adoption on existing routers; ESM+CJS
dual build with `.d.ts`; tests with ≥90% coverage; README, examples, CHANGELOG, CI, and
npm publish config.

AIDD change: `2026-09-27-express-openapi-lite`. No Jira ticket.

**Rigor / autonomy:** `critical` (chosen by classifier: public API contract + CI/infra
named in intent, 0 escalations) · `let-me-look`

## What main currently has vs. this PR

`main` already merged an **earlier PR (#2) from this same branch**, but at an early QA
snapshot (before the fix loop closed the CRITICAL/HIGH findings below). This PR is a
**forward-fix**, not a rewrite: it is a strict, non-diverging continuation of that same
history (no rebase/force-push needed — `main`'s tree is byte-identical to this branch's
merge-base). Merging this PR brings `main` from an early-QA, partially-fixed state to a
fully QA-passed, G3-approved state.

## What changed

- **ST-001 — scaffold**: package scaffold, dual ESM+CJS+DTS build (tsup), CI workflows
  (Node 22/24 × Express 4/5), publish config.
- **ST-002 — config**: `ApiDocsOptions` with defaults + full override surface, config
  validation.
- **ST-003 — schema adapter**: `SchemaAdapter` port, Standard Schema zero-config default,
  optional Zod adapter via `express-api-contract/zod` subpath.
- **ST-004 — typed route**: `route()` helper — request validation (params/query/body),
  response validation, RFC 9457 `problem+json` errors, async handler support, incremental
  adoption alongside existing Express routes.
- **ST-005 — introspection**: Express `use()` auto-detection (4/5), `describe()` for
  manual route registration, route registry with dedup.
- **ST-006 — spec builder**: deterministic OpenAPI 3.1 document builder, `$defs`
  hoisting into `components.schemas`.
- **ST-007 — serve/docs**: `/openapi.json` + docs UI endpoints, schema-adapter
  memoization.
- **ST-008 — docs & release**: README, runnable example, CHANGELOG `[0.1.0]`.
- **QA fix loop** (findings F-01 CRITICAL, F-02/F-04 HIGH, F-22 MEDIUM — all fixed and
  independently re-verified): `src/spec/build.ts` ($defs hoisting was incomplete for
  `requestBody`/`response`, plus a same-name-different-schema collision guard),
  `src/spec/glob.ts` (a non-global regex bug that could crash with an uncaught
  `SyntaxError`), `src/route/typed.ts` + `src/serve/router.ts` (missing schema-adapter
  memoization).

## Quality verdict

| Phase | Verdict | Notes |
|---|---|---|
| Inception | PASS | 47 ACs, G1 re-approved after 2 revision rounds |
| Construction | PASS | 8/8 stories built, 0 rework beyond 3 architect backflow ADRs (ratified as-built) |
| QA | PASS | Critic: APPROVE WITH CONDITIONS · Supervisor: COMPLIANT |
| Delivery | in progress | this PR |

**Findings funnel:** 6 raised (post-implementation review + adversarial verification +
exhaustive testing) → 4 CONFIRMED blocking (F-01 CRITICAL, F-02/F-04 HIGH, F-22 MEDIUM,
found during the fix-loop closure re-check) → all 4 fixed with TDD evidence and
independently re-verified → 1 refuted (F-03, HIGH claim, demoted to LOW/advisory: real
scaling is linear, not the claimed quadratic) → 1 advisory-only (F-21, LOW, no AC
violated).

## AC matrix summary

**47/47 PRD ACs: PASS** (`ac-matrix.md`, every AC independently re-executed on-host) ·
**PROVEN** (Auditor final audit, 0 DISPUTED, settled round 1 of a 2-round budget) ·
**RECONCILED** (Tally, 0 gaps, 0 orphaned diff files).

## Evidence

- Full suite: 78–79 files, 637–644 tests passing (5 legitimate skips), coverage
  98.56% stmts / 93.35% branches / 99.45% fns / 99.34% lines (target ≥90%).
- Mutation testing (full project, clean-state): **84.39%** (floor 70%).
- Determinism: reproduced twice per critical rigor; 2 tests quarantined for
  host-CPU-contention flakiness (`test/entries/minified.test.ts`,
  `test/meta/lint-rules.test.ts`) — confirmed not app regressions (pass reliably in
  isolation/parallelism-1/reverse-order/`TZ=UTC`); no AC cites either test.
- Security: clean — 0 secrets, `npm audit` exit 0, no CRITICAL/HIGH advisories (only
  dev-only LOW/MODERATE transitive + INFO hardening notes). SBOM at `qa/sbom.json`.
- Pre/post evidence: `evidence/pre/`, `evidence/post/` (7 affected flows + 4 perf
  benches + the ADR-26 perf gate, all captured with real transcripts).

## Cost

**Spend:** 7,886,586 / 20,000,000 tokens (39%) · 2,175.6 / 2,500 min (87%) ·
`within_cost_budget: passed` · stops: 1 row, disposition `raised` (soft threshold at
88% of an earlier, since-raised ceiling — resolved, not pending).

By phase: inception 2,694,542 tok / 102.0 min · construction 2,718,693 tok / 525.9 min ·
qa 2,473,351 tok / 1,547.7 min.

## Reversibility

`git revert` the merge commit this PR creates — the package is net-new (no existing
consumers, no migrations, nothing else in the repo depends on it yet).

## Known gap — receipts-v1 mechanical evidence (does not block merge)

`evidence_contract: receipts-v1` requires `aidd-evidence.py capture` to produce
`evidence/receipts/**` and `evidence/acceptance.json`. That script hard-requires POSIX
process groups and cannot run on the native-Windows host this change was built on (no
usable WSL distro with Python 3.9+ was available locally). Every one of the 47 ACs is
independently proven by real, directly-executed test evidence (`ac-matrix.md`) — this
gap is procedural/infrastructural, not a semantic defect, and is disclosed identically
in `ac-matrix.md`, `qa/tally.md`, `qa/critic-verdict.md`, and the mechanical delivery
preflight (`delivery/readiness.json`, the only two remaining failures in that report).

**Follow-up condition (from the Critic verdict):** run `aidd-evidence.py capture` +
`manifest` on a POSIX host (this repo's own CI runs on `ubuntu-latest`) to produce the
missing receipts-v1 artifacts before or shortly after merge.

**Other Critic conditions:**
- Track the 2 quarantined flaky tests to de-quarantine (confirmed host-CPU-contention
  flakes, not regressions).
- Opportunistic `npm audit fix` for the dev-only `qs` moderate advisory at the next
  maintenance window.

## Supervision

Supervisor final audit (QA step 17): **COMPLIANT**. Full QA-phase audit-log replay
(steps 1–16) found every required dispatch present and correctly ordered; the exit
checklist in `40-qa.md` was walked line-by-line with cited evidence for every item; gate
sha256 hashes were spot-checked against artifacts on disk. Explicitly reviewed and found
compliant: the receipts-v1 gap disclosure, that no AC rests solely on a quarantined
test, and an orchestrator cost-ledger correction made at QA step 15.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
