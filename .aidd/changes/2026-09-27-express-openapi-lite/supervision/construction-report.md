# Supervisor Report — Construction Phase Boundary (post wave 7)

Change: 2026-09-27-express-openapi-lite · Rigor: critical · Step: con4 (phase-boundary audit)

## Exit checklist (30-construction.md)

- [x] Every story `done`/`built` with TDD evidence: ST-001..ST-008 all `status: built` in
  state.yaml; each wave's Builder Report + Master Agent monitoring note + Auditor verdict
  present (`audit/monitoring/construction-wave-1..7.md`, `audit/interrogation/*-verdict.md`).
  Auditor verdicts: ST-001 8/8 PROVEN, ST-002+ST-003 18/18 PROVEN, ST-004 13/13 PROVEN,
  ST-005 7/7 PROVEN, ST-006 16/16 PROVEN, ST-007 10/10 PROVEN, ST-008 AC-029 PROVEN. 0
  DISPUTED anywhere → no negotiation entries, no adjudication needed this phase.
- [x] Full build + suite green: final integration (ST-008 Auditor, independently re-run)
  — `Test Files 70 passed (70)`, `Tests 416 passed | 5 skipped (421)`, exit 0, coverage
  97.76/90.9/98.33/98.63, all ≥90% floor. This supersedes wave-7 Master Agent's caveat
  (that monitoring note had no shell tool and could not verify the count itself) — the
  Auditor's independent re-run closes that gap with command + exit-code evidence.
- [x] Diffs within ownership sets, 3 exceptions checked and all properly authorized:
  1. Build Fixer corrected `test/dist/pack.test.ts` and `test/dist/build-shape.test.ts`
     (ST-001/S-01-owned) at wave-6 integration red, per `build-log.md` — exactly the
     playbook's own Build-Fixer exemption (30-construction.md step 2e). Root cause and
     fix are narrowly scoped stale assertions, not new behavior; green evidence attached
     (67 files, 364/369, 12:16:55 run).
  2. ST-007 touching `package.json`'s `sideEffects` array (one element) — authorized by
     ADR-55's explicit "Ownership exception" clause and epic.md's "Scoped ownership
     exception (ADR-55)"; scope is exactly one array, one new string, confirmed in
     architecture.md ADR-55 text and build-log.md's diagnosis.
  3. ADR-54 (ST-004 `route()` 4-arg) and ADR-56 (ST-005 `describe()` 3-arg factory) —
     both architect backflows ratifying already-shipped, already-audited code as the
     real public API, zero rework, documented rationale + rejected alternatives in
     architecture.md. No diff crossed an ownership line for these two; they are doc-only
     corrections to C3/C4.
- [x] `evidence/pre/` populated: F-1..F-7 + manifest.md present (greenfield baseline).

## Specific audits requested

**(a) Dispatch-plan discipline.** Replayed `supervision/audit.log` rows 90–132 (construction
phase). Every Builder/Master-Agent/Auditor/Build-Fixer/Architect dispatch has a `dispatched`
or single combined `returned` line preceding its result, and the one deliberate parallel
dispatch (row 107: architect backflow ‖ ST-005 builder) was recorded as one resolved plan
before execution, with the disjointness rationale ("file-disjoint, Master Agent confirmed
ST-005 unaffected") stated at dispatch time, not reconstructed after. No row shows a plan
being re-decided mid-step. Compliant.

**(b) Cost ledger arithmetic.** Spot-checked cumulative math in `cost/ledger.md`:
row 81 (2694542+137831=2832373 ✓, 102.0+18.5=120.5 ✓), row 88 (3291269+221914=3513183 ✓,
188.4+154.2=342.6 ✓), row 103 (5045108+90225=5135333 ✓, 610.4+6.2=616.6 ✓), final row 106
(5241800+43770=5285570, 623.7+2.4=626.1). Ledger's last row matches
`state.yaml` `cost.spent_tokens: 5285570` and `cost.spent_minutes: 626.1` exactly — row math
and the ledger-to-state link are both sound.

**VIOLATION found:** `state.yaml` `cost.by_phase` does **not** sum to `spent_tokens`/
`spent_minutes`, breaking `protocol/supervision.md` "Cost checks" rule ("`cost.by_phase` sums
to both"): `by_phase.inception.tokens (2694542) + by_phase.construction.tokens (756006) =
3450548 ≠ 5285570`; minutes `102.0 + 242.3 = 344.3 ≠ 626.1`. `by_phase.construction` appears
stale — frozen at roughly the wave-2/3 mark and never updated through waves 4–7 (actual
construction spend from the ledger is `5285570 − 2694542 = 2591028` tokens / `626.1 − 102.0
= 524.1` minutes). **Remediation:** orchestrator recomputes `by_phase.construction` from the
ledger (`bash .aidd/framework/scripts/aidd-cost.sh`) and rewrites state.yaml before phase
advance; re-validate with `aidd-validate.py`. This does not block story/wave results (all of
which are otherwise sound) but must close before G2 re-approval/QA gate.

**(c) Stash incident (ST-008 follow-up).** Audit log row 132 and state.yaml history
(2026-09-28T07:27:41Z) document: an accidental `git stash pop` of a stale, superseded
Inception-era stash during the ST-008 follow-up dispatch caused a merge conflict across 8
`.aidd` files outside ST-008's ownership. The orchestrator's own remediation is recorded
inline (not merely asserted): 7 of 8 files verified byte-identical to committed HEAD, the
8th (`audit.log`) had only a whitespace-only diff which was reverted, `state.yaml` was
re-validated VALID, and the stale stash was dropped. This is adequate remediation — no data
loss, evidence of the verification method is named (byte-identical diff, whitespace-only
diff), and the corrective action (revert + drop stash) is complete and self-contained. No
further remediation required; recommend only a forward-looking note (not a violation) that
stash hygiene be tightened in `protocol/dispatch.md` or a builder pre-flight step, since this
is the second stash-adjacent incident class in this change's session history (the first
being the PR #1 discovery at inception).

**(d) G2 staleness characterization.** `state.yaml` `g2_plan.notes` and `history` correctly
name all three backflows (ADR-54, ADR-55, ADR-56) and label them "documentation corrections /
narrow scoped exceptions, zero rework of built stories" — this matches the architecture.md
ADR text read directly: ADR-54 and ADR-56 are pure ratifications of already-shipped, already-
audited signatures (0 rework, rejected alternatives documented), and ADR-55 is a real defect
diagnosis + a one-array-element scoped ownership exception (not a design change, and not
"zero" work — it did require a 1-line `package.json` fix + 2 stale test corrections, both
completed and green). Characterization is accurate. **G2 re-approval digest should
emphasize:** (i) zero story rework and zero new ADR-driven test/mutation work occurred for
ADR-54/56 — cite ST-004's 13/13 PROVEN and ST-005's 7/7 PROVEN verdicts as unaffected; (ii)
ADR-55's defect was real (auto-detection silently inert in the published `dist/` output) and
is now closed with runtime-verified evidence (ST-007 Auditor: "runtime-verified ADR-55 fix");
(iii) the scoped ownership exception's blast radius is exactly one array, one string element,
confirmed via build-log.md and epic.md's exception clause — not a precedent for broader
S-07-into-S-01 edit rights; (iv) net effect on the shipped public API surface is the
documentation now matching code that was already reviewed and green, not a functional change
requiring new QA scope beyond re-checking AC-006/AC-022/AC-031/AC-047 citations against the
corrected C3/C4 text, which ADR-54/56 both explicitly flag as required before G2 sign-off.

## Verdict

**VIOLATIONS** (one, cost-only, non-blocking to story/quality work): `state.yaml`
`cost.by_phase.construction` is stale and its sum with `by_phase.inception` does not equal
`cost.spent_tokens`/`spent_minutes`, breaking `protocol/supervision.md`'s cost-check rule.
Remediation: orchestrator recomputes `by_phase` from `cost/ledger.md` and re-validates
state.yaml before the phase is marked complete / before G2 re-approval. All other exit-
checklist items (TDD evidence, full-suite green, ownership-set diffs incl. the 3 documented
exceptions, evidence/pre population, dispatch-plan discipline, stash-incident remediation,
G2-staleness characterization) are COMPLIANT with cited evidence.
