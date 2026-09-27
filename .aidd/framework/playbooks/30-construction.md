# Phase: Construction

Purpose: implement every story via strict TDD, in parallel waves, with baseline evidence
captured first.

## Steps

Phase boundary: rebuild the snapshot pack
(`bash .aidd/framework/scripts/build-snapshot.sh pre-construction` per
`../protocol/context-snapshots.md`) before Step 1. This pack is the
**pre-implementation** baseline the QA delta reviewer diffs against
(`../roles/reviewer.md` mode=delta) — the only pack taken before any implementation
exists.

Every fan-out below takes its agent count, ownership rule, order, and cap from
`../protocol/dispatch.md`: the orchestrator resolves the plan ONCE per step, records it in
`supervision/audit.log`, and does not revisit it within the step — re-deciding mid-step is a
supervision VIOLATION. `Rigor:` annotations name what each rigor mode does with the step
(`../protocol/rigor-modes.md`); where one writes the shorthand `<gate>: na`,
`reason: rigor:<mode>`, it means the object form `{status: na, reason: rigor:<mode>}` that
`../protocol/gates.md` §The `na` encoding defines and the schema enforces.

1. **Step 0 — pre evidence**: dispatch Evidence Capturer (`../roles/evidence-capturer.md`)
   with `stage: pre` over the PRD's affected-flows table + bench commands →
   `evidence/pre/` + manifest rows. Blocks wave 1 until complete.
   Rigor: fast — skip (record `evidence_captured: na`, `reason: rigor:fast`; the build+suite
   transcript is the only evidence); standard/critical — full capture.
2. For each wave in `epic.md` order:
   a. Fan out Builder (`../roles/builder.md`) for the wave's stories (cap 4).
      Sequential fallback: story-id order. Parallel only when the wave's ownership sets are
      provably pairwise disjoint (`../protocol/dispatch.md` ownership rule).
      Rigor: all modes — every story is built, under TDD, in every mode (the floor).
   b. As each returns, run the **TDD evidence check**: Builder Report must show
      (i) failing-test evidence, then (ii) green evidence, plus (iii) `git diff --stat`
      confined to the ownership set. Violation → story back to `ready`, ONE re-dispatch
      with the violation named.
   c. **Master Agent monitoring** — dispatch Master Agent (`../roles/master-agent.md`)
      `mode: monitor` over the wave's Builder Reports →
      `audit/monitoring/construction-wave-<n>.md` (the wave is the step token per
      `<phase>-<step>`, master-agent.md): a substantive quality read of the work itself
      (does the cited evidence actually support the claim? were corners cut?), never
      process compliance and never dispatch mechanics.
      Rigor: fast — skip (Layer 2 off; note recorded `na`, `reason: rigor:fast`);
      standard/critical — one note per wave.
   d. **Auditor interrogation** — dispatch Auditor (`../roles/auditor.md`) over the wave's
      Builder Reports, one subject per report, max **2** challenge rounds per subject
      (`../protocol/interrogation.md`) → `audit/interrogation/<subject-id>-verdict.md`, every
      claimed AC exactly `PROVEN` or `DISPUTED`. Each DISPUTED AC goes to
      `../protocol/negotiation.md` against this wave's monitoring note — unless that note
      already concurs the work is deficient, in which case the short-circuit rule skips
      negotiation and the AC becomes a fix-loop defect directly (still exactly one log line).
      A DEFECT re-enters the story's remediation ladder (story back to ready, one
      re-dispatch).
      Rigor: fast — skip (record `auditor_approved: na`, `reason: rigor:fast`);
      standard — 1 round per subject, negotiation 1 exchange; critical — 2 rounds per
      subject, negotiation 2 exchanges.
   e. **Wave integration check** (orchestrator): run canonical build + full test suite.
      Red → Build Fixer (`../roles/build-fixer.md`), max 3 attempts, then blocked path.
   f. **Snapshot rebuild** — `bash .aidd/framework/scripts/build-snapshot.sh post-wave-<n>`
      per `../protocol/context-snapshots.md`.
3. After the final wave (incl. seam stories): full integration check again; set
   `quality_gates.tests_green`.
4. **Supervisor audit**. Rigor: all modes — never skipped; it also checks that each step's
   recorded dispatch plan matches what was dispatched, and that every `na` carries its
   `reason: rigor:<mode>`.

## Blocked ladder (per story)

fresh re-dispatch → Architect scoped re-plan (ADR amendment; G2 → stale; delta stories
if needed) → human escalation. A blocked story blocks only its dependents.

## Exit checklist

- [ ] every story `done` with TDD evidence
- [ ] full build + suite green (evidence blocks)
- [ ] all diffs within ownership sets
- [ ] evidence/pre populated (or explicit `na` rows)
