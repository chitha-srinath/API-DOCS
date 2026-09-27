# Phase: Inception

Purpose: intent → approved PRD → judged architecture, stress-tested and impact-assessed →
parallel-safe stories, reviewed against the live codebase BEFORE any code.

## Steps

Phase boundary: rebuild the snapshot pack
(`bash .aidd/framework/scripts/build-snapshot.sh pre-inception` per
`../protocol/context-snapshots.md`) before Step 1.

Every fan-out below takes its agent count, order, and cap from `../protocol/dispatch.md`
(one lookup per step, recorded, never re-decided). `Rigor:` annotations name what each
rigor mode does with the step (`../protocol/rigor-modes.md`); unannotated steps run
identically in all three modes.

1. **Clarify** — dispatch Product Analyst (`../roles/product-analyst.md`), stage 1:
   `questions.md` section inside `intent.md`. Resolve per mode
   (`../protocol/autonomy-modes.md`). Zero open BLOCKING questions may remain.
2. **PRD** — Product Analyst stage 2 → `prd.md` (testable ACs with ids; Jira ACs imported
   per `../protocol/jira-sync.md`; affected-flows table for evidence capture).
   For `evidence_contract: receipts-v1`, also produce `requirements.json` from
   `../templates/requirements.json`, with the identical AC ids and criterion text. G1 binds
   both files; later criteria changes require renewed approval.
3. **GATE G1** (`g1_prd`) per `../protocol/gates.md`.
4. **Architecture candidates** — dispatch Architect (`../roles/architect.md`) three times
   in parallel with lenses `simplicity-first`, `scalability-first`, `risk-first` →
   `arch-candidates/<lens>.md`.
5. **Judge panel** — dispatch Arch Judge (`../roles/arch-judge.md`) ×3 in parallel →
   `arch-candidates/scorecard-<n>.md`. Majority winner.
6. **Synthesis** — Architect synthesis run → `architecture.md` with **Verification
   Commands** (orchestrator dry-probes each; broken → bounce once) and **Bench Commands**.
7. **Independent thinking** — dispatch Independent Thinker
   (`../roles/independent-thinker.md`) → `counter-arguments.md`: the strongest honest case
   against the synthesized approach. Surfaced in the G2 digest; a decisive objection sends
   the Architect back for a revision.
8. **Epic** — Epic Scoper (`../roles/epic-scoper.md`) → `epic.md`. Orchestrator runs the
   mechanical disjointness check (`../protocol/file-scope.md`).
9. **Stories** — fan out Story Author (`../roles/story-author.md`), one per story (cap 6).
   Orchestrator lints each story file: required sections + schema-valid frontmatter.
10. **Impact analysis** — dispatch Impact Analyst (`../roles/impact-analyst.md`) →
    `impact-report.md`: blast radius through caller, contract, data, and CI/CD lenses with
    cited call sites and a LOW/MEDIUM/HIGH rating. Any file the blast radius reaches that no
    story owns goes back to the Epic Scoper (a disjointness risk); HIGH ratings sharpen the
    pre-review focus.
11. **Pre-implementation review** — fan out Reviewer (`../roles/reviewer.md`) with
    `mode: pre`, dimensions: feasibility, pattern-fit, coupling-risk, test-strategy →
    `pre-review/<dimension>.md`. CRITICAL findings resolved (artifact revised) or explicitly
    waived by the human; log resolutions.
    Rigor: fast — 2 dimensions (feasibility, pattern-fit); standard/critical — all 4.
12. **Supervisor audit** → then **GATE G2** (`g2_plan`). Before the digest, re-run the rigor
    classifier over the G2 surface (ownership sets ∪ `impact-report.md` reach ∪ story `risk`
    markers) per `../protocol/rigor-modes.md`: it may only escalate, and an escalation here
    back-fills nothing in Inception — it changes what Construction and QA will run.
    Rigor: all modes — the classifier re-run and the Supervisor audit always happen.

## Exit checklist

- [ ] G1 + G2 approved (ledger entries with hashes)
- [ ] zero open BLOCKING questions; assumptions logged
- [ ] judge scorecards present; synthesis cites winner
- [ ] counter-arguments produced; any decisive objection resolved
- [ ] impact-report present with a rating; reach-outside-ownership resolved
- [ ] verification commands probed OK
- [ ] ownership matrix disjoint per wave (or CONCERNS recorded)
- [ ] every story file lints; pre-review CRITICALs resolved/waived
