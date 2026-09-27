# Gate Protocol

Three human-relevant gates plus one QA sub-gate. Construction/Delivery exits are
evidence-only (no approval semantics).

| Gate | Key | After | Artifacts bound |
|---|---|---|---|
| G1 | `g1_prd` | PRD drafted | `prd.md`; also `requirements.json` for receipts-v1 |
| G2 | `g2_plan` | Pre-implementation review resolved | `architecture.md`, `counter-arguments.md`, `impact-report.md`, `epic.md`, `stories/*`, `pre-review/*` |
| G3 | `g3_premerge` | QA verdict + critic verdict computed | `qa/*`, `qa/critic-verdict.md`, `ac-matrix.md`, `evidence/post/*`; also `evidence/acceptance.json` and `evidence/receipts/*` for receipts-v1 |
| test-report | `g_test_report` | Exhaustive test report consolidated | `qa/test-report.md` |

## Uniform mechanism (both modes)

At a gate the orchestrator always:

1. Computes a **gate digest**: ≤20 lines — key decisions, assumptions, risks, the
   counter-arguments and impact rating (G2), and the verdict table + critic verdict + diff
   stats (G3); plus the artifact list with sha256 hashes.
2. Obtains a **disposition**:
   - `let-me-look`: set `phase_status: awaiting_gate`, present the digest, STOP. Accepted
     responses: **approve** · **revise: <notes>** · **abort**.
   - `take-care`: disposition is `approve` recorded as `approved_by: auto` — UNLESS an
     escalation flag is set (open BLOCKING question, disjointness CONCERNS, unresolved
     pre-review CRITICAL, open CONFIRMED finding, open test FAIL, AC matrix FAIL, critic
     REJECT, unresolved supervision VIOLATION, UNRESOLVABLE adjudication ruling (disputed
     AC without a PROVEN/DEFECT resolution), an automatic rigor escalation
     (`rigor-modes.md`) since the change's risk assessment moved under the framework's own
     feet), in which case this gate behaves exactly like `let-me-look`.
3. Appends the gate entry to `gates` in change state and advances.

## The `g_test_report` sub-gate

After the exhaustive test report is consolidated (QA step 14), the orchestrator seeks
approval before annotating stories with the report. On approval it records `g_test_report`
AND writes a `## Test Report` section into every affected story. In `take-care` this
auto-approves unless an executed FAIL is still open.

## The critic verdict

The Critic (QA step 16) returns APPROVE / APPROVE WITH CONDITIONS / REJECT, setting the
`critic_approved` quality gate: APPROVE→passed, CONDITIONS→passed (conditions recorded in
the ledger + PR body), REJECT→failed (blocks G3; re-enter the fix loop or escalate).

## Staleness (precision rule)

Approval binds to content: the entry records each artifact's sha256 in `artifacts`, an
array of `{path, sha256}` objects. Paths are relative to the change directory, unique,
and must resolve to files inside it; hashes are full 64-character SHA-256 values.
Expand directory patterns recursively to include every file at approval time. A newly
added file in a bound directory also makes approval stale. Record hashes only when the
human or automatic disposition is obtained, never refresh them to conceal a change.

```yaml
g1_prd:
  status: approved
  approved_by: human
  at: "2026-09-24T12:00:00Z"
  artifacts:
    - path: prd.md
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

The hash above illustrates the format; compute the hash of the actual artifact bytes.
Legacy `artifact` / `artifact_sha256` single-file entries remain schema-valid for resume,
but delivery requires complete bindings and full hashes. Re-approve incomplete legacy
gates; do not infer approval of additional files.

The read-only `core/scripts/aidd-ready.py` enforces delivery readiness on every tier:
all schema-defined quality gates, mode-specific exemptions, required approvals and artifact
coverage, current hashes, unresolved cost stops, supervision, stories and repeatability
records. It returns 0 for ready, 1 for blocked, 2 for invalid input. The Delivery playbook
requires it immediately before push. It validates recorded evidence structure and freshness,
not whether a test genuinely proves a requirement; the verification roles still own that.
For receipts-v1, it also verifies the approved requirement set, successful suite and AC
receipts, output hashes, and current source fingerprints per `execution-receipts.md`.

For `fast`, G3 does not require the skipped `evidence/post/` directory. All other bound
artifact groups remain required. A recorded rigor escalation requires a human G3 approver
in both modes. No runtime may replace this preflight with an asserted pass.

If a gated artifact
changes afterwards, the gate flips to `stale` and must re-pass. Auto and human approvals
share an identical entry structure.

## Quality gates (mode-independent)

Sixteen, and `core/schemas/change-state.schema.json` is the authoritative set — this list
and that schema must agree:

`tests_green, exhaustive_tests_passed, qa_findings_resolved, e2e_verified,
mutation_floor_met, security_clean, perf_within_budget, acs_verified, evidence_captured,
supervision_compliant, critic_approved, auditor_approved, debate_complete,
tally_reconciled, within_cost_budget, evidence_reproduced` — all must be `passed` (or
explicitly `na` with a recorded reason) before Delivery pushes anything. Autonomy modes
modulate human approval, never quality.

The last two are mode-independent on identical terms to the other fourteen, and each is
defined in the protocol that owns it rather than here:

| gate | defined in | records `na` when |
|---|---|---|
| `within_cost_budget` | `cost-governance.md` §9 | no dispatch ran at all, with `reason: cost:no-dispatches` — the one `na` reason in the whole framework that is not `rigor:<mode>` |
| `evidence_reproduced` | `determinism.md` §6 | `fast` mode, with `reason: rigor:fast` |

## The `na` encoding (canonical)

A quality-gate value takes **one of two forms**, and this section is the single place that
defines them. `core/schemas/change-state.schema.json` enforces exactly this.

```yaml
quality_gates:
  tests_green: passed              # scalar form — a gate with no reason to record
  mutation_floor_met:              # object form — a gate that must explain itself
    status: na
    reason: "rigor:fast"
```

- **Scalar form** — the bare status (`pending` | `passed` | `failed` | `na`). Valid for any
  gate that has nothing to explain.
- **Object form** — `{status, reason}`, closed: `status` is required and takes the same four
  values, `reason` is a string, and no other key is accepted. **A gate skipped by rigor mode
  is written in the object form**, `{status: na, reason: rigor:<mode>}`. There is no third
  encoding: a sibling `reason` key next to a scalar status is rejected by the schema, which
  is what stops the reason from drifting away from the gate it belongs to.

## Rigor modes and `na`

The active rigor mode (`rigor-modes.md`) decides how much verification runs, so a gate whose
step that mode does not run is **not applicable**, not skipped: it records the object form
above (e.g. `mutation_floor_met: {status: na, reason: rigor:fast}`). A silently absent gate
is a supervision VIOLATION; an `na` written in the scalar form, with its reason nowhere, is
the same violation. An automatic escalation voids every `na` earned under the outgone mode —
those gates flip back to `pending` and must be earned in the new mode.

Rigor never touches the floor: `tests_green`, `acs_verified`, `supervision_compliant` and
`critic_approved` are earned in every mode, `na` never available to them.
