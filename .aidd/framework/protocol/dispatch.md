# Dispatch Protocol

How many agents, who owns which files, parallel or sequential, and in what order — by
**lookup**, never by judgment. The orchestrator does not decide fan-out; it resolves it
from the table below, records the resolved plan, and executes it.

This exists because re-deciding dispatch every step is the framework's largest source of
overhead and drift: the same step gets a different shape on every run, ownership arguments
get re-litigated, and nobody can tell afterwards what was supposed to happen. A table has
none of those failure modes.

## Resolution algorithm

Once per step, in this order:

1. Read the step's `(phase, unit-of-work)` pair from its playbook — or, for the `PR review`
   rows, from the numbered phases of `pr-review.md`, which is a protocol rather than a
   playbook because an external PR review sits outside the phase machine.
2. Read `rigor.mode` from change state (`rigor-modes.md`). Absent → `standard`.
3. Look up the row. The row gives the unit count for that mode, the ownership rule, the
   dispatch mode, the cap, and the deterministic order.
4. Apply the **ownership rule** (below). Disjointness unproven → sequential.
5. Apply the **cap** — units beyond it queue in the documented order.
6. Record the resolved plan in `supervision/audit.log` (format below).
7. Execute exactly that plan. Do not revisit it within the step.

## Context brief — what every dispatched agent reads first

The table above decides *how many* agents run. This decides *what each one reads*, and it
is the same for every row: **structure first, spans on demand, never a file to find a
symbol** (`context-index.md`).

Every dispatch brief carries, in this order:

1. The **snapshot pack** (`snapshot.md`, and `quality-baseline.md` where the role's
   dimension needs it) — what the repo is (`context-snapshots.md`).
2. The **index** (`.aidd/context/index.json`) — where every symbol lives.
3. The role's **own inputs** — its ownership set, its brief, its artifacts.

Source text is **not** part of a brief. An agent that needs a symbol queries for it:

```bash
.aidd/framework/scripts/aidd-read-block.py <file> <symbol>
```

Three consequences the orchestrator enforces rather than hopes for:

- **A verification dispatch carries a patch reference, not file bodies.** The verifier
  resolves surrounding context through `read_block` (`pr-review.md` §6, `context-index.md`
  §6). Findings still cite `file:line` against the post-change tree.
- **Test output reaches a role redacted**, never raw — error type, failing assertion, and
  `file:line`, with the reduction ratio recorded (`aidd-redact-log.py`).
- **A missing index never blocks a dispatch.** The agent falls back to reading files and
  the degradation is recorded, exactly as a missing snapshot pack is (`evidence.md`).

Reading a whole file is still correct when the file *is* the unit — a config, a short
module, a diff. The rule is not "never open a file"; it is **never open a file merely to
locate something the index already knows**.

## Decision table

Unit counts read `fast / standard / critical`. A unit is one dispatch of one role.

**`Class` is the row's stable identifier**, and it is what everything downstream keys on: the
`class` column of `cost/ledger.md` (`../templates/cost-ledger.md`), the per-class medians and
projection in `aidd-cost.sh` (`cost-governance.md` §4), and the `class=` field of the
recorded dispatch plan. It exists because the `Step` cell cannot do that job — `QA 1` names
two different rows, and `QA 3, 5, 9` and `QA 4, 5, 10` are compound, so grouping cost on the
step text would merge unrelated dispatches and split related ones. Class ids are unique
within this table, and an id is never reused for a different unit of work.

| Step | Class | Unit of work | Units (fast / std / crit) | Dispatch | Cap | Deterministic order |
|---|---|---|---|---|---|---|
| Inception 4 | `inc4-arch` | architecture candidate (lens) | 3 / 3 / 3 | parallel (artifact-disjoint) | 3 | lens asc: `risk-first`, `scalability-first`, `simplicity-first` |
| Inception 5 | `inc5-judge` | judge scorecard | 3 / 3 / 3 | parallel (artifact-disjoint) | 3 | scorecard index asc |
| Inception 6 | `inc6-synth` | architecture synthesis | 1 / 1 / 1 | sequential | 1 | — |
| Inception 7 | `inc7-thinker` | independent thinker | 1 / 1 / 1 | sequential (after synthesis) | 1 | — |
| Inception 8 | `inc8-scoper` | epic scoper | 1 / 1 / 1 | sequential | 1 | — |
| Inception 9 | `inc9-story` | story author | one per story | parallel (artifact-disjoint: one story file each) | 6 | story-id asc |
| Inception 10 | `inc10-impact` | impact analyst | 1 / 1 / 1 | sequential | 1 | — |
| Inception 11 | `inc11-prereview` | pre-review dimension | 2 / 4 / 4 | parallel (artifact-disjoint) | 4 | dimension asc: `coupling-risk`, `feasibility`, `pattern-fit`, `test-strategy` (fast set: `feasibility`, `pattern-fit`) |
| Construction 1 | `con1-evidence-pre` | evidence capturer (`stage: pre`) | 0 / 1 / 1 | sequential, blocks wave 1 | 1 | — |
| Construction 2a | `con2a-builder` | builder (wave story) | every story in the wave | parallel ONLY if the wave's ownership sets are pairwise disjoint | 4 | story-id asc |
| Construction 2c | `con2c-monitor` | Master Agent `mode: monitor` (per wave) | 0 / 1 / 1 | sequential, after the wave's builders return | 1 | wave asc |
| Construction 2d | `con2d-interrogation` | Auditor interrogation subject (Builder Report) | 0 / one per report | parallel (artifact-disjoint per subject-id) | 4 | subject-id asc; rounds WITHIN a subject strictly sequential |
| Construction 2e | `con2e-integration` | integration check / build fixer | 1 / 1 / 1 | sequential, alone | 1 | — (crosses ownership lines by exemption — never parallel with a builder) |
| QA 1 | `qa1-dim` | post-review dimension (incl. `mode: delta`) | 2 / 6 / 6 | parallel (artifact-disjoint) | 6 | dimension asc: `correctness`, `delta`, `performance`, `security`, `spec-compliance`, `test-coverage` (fast set: `correctness`, `spec-compliance`) |
| QA 1 | `qa1-sec` | security auditor | 0 / 1 / 1 | parallel with the dimension fan-out (own artifact) | 1 | — |
| QA 3 | `qa3-adversarial` | adversarial verifier (per CRITICAL/HIGH finding) | only if a CRITICAL exists / all / all | parallel; file-grouped if >12 findings | 6 | finding number asc |
| QA 3, 5, 9 | `qa-monitor` | Master Agent `mode: monitor` (per batch) | 0 / 3 / 3 | sequential, one per closed batch | 1 | batch order: review, test, verification |
| QA 4, 5, 10 | `qa-debate` | debate exchange | 0 / ≤2 (design only) / ≤6 | strictly sequential — an exchange is one challenge plus its response | 1 | surface pipeline order (design → execution → results); within a batched challenge, category asc |
| QA 5 | `qa5-test` | test engineer (per category) | 2 / 5 / 8 | parallel (artifact-disjoint) | 6 | category asc: `api-contract`, `boundary-edge`, `functional-happy-path`, `impossible-abuse`, `negative-error-handling`, `performance-smoke`, `regression-compat`, `state-concurrency-idempotency` |
| QA 6 | `qa6-fixloop` | fix-loop builder (per defect group) | one per owning story | parallel ONLY if the owning stories' ownership sets are pairwise disjoint | 4 | story-id asc |
| QA 7 | `qa7-e2e` | E2E verifier | 0 / 1 / 1 | sequential, alone — clean state means nothing else runs | 1 | — |
| QA 8 | `qa8-evidence-post` | evidence capturer (`stage: post`) | 0 / 1 / 1 | sequential | 1 | — |
| QA 9 | `qa9-ac` | AC assessor | 1 / 1 / 1 | sequential | 1 | — |
| QA 11 | `qa11-tally` | tally | 0 / 1 / 1 | sequential | 1 | — |
| QA 12 | `qa12-audit` | Auditor final audit subject | 0 / one per subject | parallel (artifact-disjoint per subject-id) | 4 | subject-id asc |
| QA 13 | `qa13-negotiation` | negotiation (per disputed AC) | 0 / ≤1 / ≤2 exchanges | strictly sequential, one AC at a time (the counter resets per AC) | 1 | ac-id asc |
| QA 16 | `qa16-critic` | critic | 1 / 1 / 1 | sequential | 1 | — (never skipped) |
| Delivery 1 | `del1-docs-prep` | doc writer + delivery-agent prep | 2 / 2 / 2 | parallel ONLY if the doc set and the commit set are disjoint | 2 | documented fallback: Doc Writer, then Delivery Agent |
| Delivery 2–4 | `del2-delivery` | delivery agent | 1 / 1 / 1 | sequential | 1 | — |
| Delivery 6 | `del6-supervisor` | Supervisor final session report | 1 / 1 / 1 | sequential | 1 | — |
| Retro 1 | `retro1-learner` | retro learner | 1 / 1 / 1 | sequential | 1 | — |
| PR review 1a | `pr1-file` | PR file reviewer (one changed source file, or a component + its helper as one bundle) | one per changed source file (all modes) | parallel (artifact-disjoint) | 6 | path asc |
| PR review 1b | `pr1-sweep` | PR sweep agent (batched trivial/cosmetic · batched E2E + config YAML) | 1 / 2 / 2 | parallel (artifact-disjoint) | 2 | bundle asc: `config-e2e`, `cosmetic` (fast: one merged `sweep` bundle) |
| PR review 1c | `pr1-dim` | PR dimension specialist (the repo's roster, or AIDD's six) | 2 / 6 / 6 | parallel (artifact-disjoint) | 6 | dimension asc: `correctness-types`, `duplication-consistency`, `framework-invariants`, `security`, `tenant-boundary`, `test-coverage` (fast set: `correctness-types`, `framework-invariants`) |
| PR review 1d | `pr1-spec` | PR specialist lens (stack-detected roster, availability-probed — `pr-review.md` §15) | 0 unless a redline path is touched / stack primary + `security` when triggered + `test-quality` / the full triggered set | parallel (artifact-disjoint: one `pr-review/specialists/<lens-key>.md` each) | 4 | resolved agent name asc, lens key asc as tie-break |
| PR review 2 | `pr2-verify` | adversarial verifier `mode: pr` (per finding) | every finding / every finding / every finding | parallel (artifact-disjoint per finding id); file-grouped above 12 findings, never grouped back to the finder | 6 | finding id asc |
| PR review 3 | `pr3-cross` | PR cross-cutting reviewer | 1 / 1 / 1 | sequential, after every verdict is in | 1 | — |
| PR review 3b | `pr3-unknowns` | PR unknown-unknowns pass (what SHOULD have changed and did not — `pr-review.md` §16.2) | 1 / 1 / 1 | sequential, same role as `pr3-cross`, own artifact `pr-review/unknown-unknowns.md` | 1 | — (never skipped in any mode) |
| PR review 4 | `pr4-comments` | PR comment validator | 1 / 1 / 1 | sequential, last | 1 | — |
| Every phase boundary | `phase-supervisor` | Supervisor phase audit | 1 / 1 / 1 | sequential | 1 | — (never skipped in any mode) |

## Ownership rule (mechanical)

Parallel dispatch is permitted **only** when the units' file-ownership sets are provably
pairwise disjoint per `file-scope.md`. Three ways a plan proves it, and one that does not:

1. **Artifact-disjoint by construction** — each unit writes exactly one artifact named by
   its own unit key (`pre-review/<dimension>.md`, `qa/tests/<category>.md`,
   `arch-candidates/<lens>.md`, `audit/interrogation/<subject-id>-*.md`). Distinct keys ⇒
   distinct paths ⇒ disjoint. No further reasoning needed.
2. **Declared-ownership-disjoint** — builders. The orchestrator pairwise-intersects the
   wave's `file_scope.owns` exact paths and `file_scope.creates` prefixes
   (`file-scope.md` rule 1). Empty intersections ⇒ parallel.
3. **Append-shared ⇒ never parallel** — two units appending to the SAME file
   (`audit/negotiation-log.md`, one `audit/debate/<category>.md`, a story file's report
   sections) are sequential, always, whatever the table's cap says.
4. **Unproven ⇒ sequential.** If disjointness cannot be proven from the epic's ownership
   sets or from rule 1, the answer is sequential in the row's documented order. There is no
   case-by-case reasoning, no "probably fine", no reading the code to guess.

Sequential order is the row's **deterministic order** — story-id, dimension name, category
name, subject-id, ac-id, or repo-relative path, ascending. Ascending means byte-wise
ascending on the exact identifier string, so two runs of the same step produce the same
order.

### PR review: artifact-disjointness and the different-agent routing rule

The `PR review` rows are artifact-disjoint by construction (rule 1), and their unit keys are
what proves it: `pr1-file` writes `pr-review/files/<path-slug>.md`, one per changed source
file; `pr1-sweep` writes `pr-review/sweeps/<bundle>.md`; `pr1-dim` writes
`pr-review/dimensions/<dimension>.md`; `pr1-spec` writes
`pr-review/specialists/<lens-key>.md`; `pr2-verify` writes
`pr-review/verdicts/<finding-id>.md`; `pr3-cross`, `pr3-unknowns` and `pr4-comments` write one
file each (`pr-review/cross-cutting.md`, `pr-review/unknown-unknowns.md`,
`pr-review/comments.md`).
Distinct keys ⇒ distinct paths ⇒ parallel is permitted with no further reasoning. Per-file
agents never share an artifact, so two agents can never both own a file's findings.

`pr1-spec` keys its artifact on the **lens key**, not on the resolved agent, so two lenses that
a repo's `pr_review.roster` maps onto the same agent still write disjoint artifacts — and so a
lens that degraded to `pr-file-reviewer` `mode: lens` (`pr-review.md` §15.5) writes the same
path its specialist would have. A specialist's findings enter `pr2-verify` exactly like a
per-file agent's: `raised_by` is the lens key, `verified_by` is a different unit, and the
verifier sets the severity. A missing specialist degrades the row; it never removes it.

`pr2-verify` carries one extra mechanical rule the other rows do not (`pr-review.md` §6.1):
**a finding is never verified by the agent that raised it.** Every finding carries
`raised_by: <unit-key>` written by its finder, verification is dispatched only as the
`adversarial-verifier` role — never as a role that raises findings — and the plan line
records `finding=<id> raised_by=<unit-key> verified_by=<verifier-unit>` with
`verified_by ≠ raised_by` asserted before dispatch. Above 12 findings the row groups
verification by FILE; a group is never handed to a finder that raised anything in it.

## Runtime without parallelism

The fallback is not a different plan — it is the same units, the same count, the same
order, run one at a time. Results are order-independent because units communicate only
through artifacts (`../playbooks/00-pipeline.md`). The recorded plan states
`mode=sequential reason=runtime-no-parallel`, so the degradation is explicit and the
Supervisor can see the plan was not silently reshaped.

## Batching rule

Units beyond the cap **queue** in the documented order and dispatch as slots free. Never
spawn beyond the cap to go faster: the cap is what keeps the context and the audit trail
of a step bounded. Never drop queued units to fit the cap either — a unit the table
requires runs, or the step is incomplete.

## Never re-decide

The table is consulted **once per step**. The orchestrator records the resolved plan and
must not revisit it within the step — not after a slow unit, not after a failure, not
because a returning unit suggests a different split. A unit that fails follows its own
remediation ladder in its playbook (re-dispatch, blocked path, fix loop); remediation
re-dispatches the SAME unit, it does not re-shape the plan.

**Re-deciding a dispatch plan mid-step is a supervision VIOLATION.** The evidence of the
breach is the audit log itself: two `dispatch-plan` lines for one step token, or executed
dispatches that do not match the recorded plan. A step whose scope genuinely changed
(backflow delta stories, an escalated rigor mode) does not re-decide the old step — it
starts a NEW step with a new token and its own single plan.

Recorded as one line in `supervision/audit.log` (`supervision.md` format, role
`orchestrator`, status `dispatched`). `class=` carries the row's class id, which is what
lets the Supervisor match the plan against the ledger rows it produced:

```text
2026-08-06T10:14:02Z | construction | orchestrator | wave-2 | dispatched | dispatch-plan class=con2a-builder units=3 agents=3 mode=parallel cap=4 order=ST-004,ST-005,ST-006
```

## Worked examples

### Inception — pre-review, `standard`

Row `Inception 11`: units 4, parallel (artifact-disjoint), cap 4, dimension asc.

```text
units   = coupling-risk, feasibility, pattern-fit, test-strategy
agents  = 4 (Reviewer mode=pre, one dimension each)
order   = as listed (ascending); parallel — each writes only pre-review/<dimension>.md
queue   = none (4 ≤ cap 4)
```

In `fast` the same row yields 2 units (`feasibility`, `pattern-fit`), 2 agents, same rule.

### Construction — 7 stories, 3 waves, `standard`

`epic.md`: wave 1 = ST-001, ST-002, ST-003, ST-004, ST-005 (all ownership sets pairwise
disjoint); wave 2 = ST-006, ST-007 (disjoint); wave 3 = ST-008, the seam story, solo.

```text
wave 1  builders: units 5, disjoint ⇒ parallel, cap 4
        ⇒ agents 4 (ST-001..ST-004), ST-005 queued, dispatched as the first slot frees
        then 1× Master Agent monitor (wave-1)
        then Auditor interrogation: 5 subjects, artifact-disjoint ⇒ parallel, cap 4
             ⇒ 4 subjects, 5th queued; 1 round each (standard)
        then integration check (sequential, alone)
wave 2  builders: units 2, disjoint ⇒ parallel, 2 agents
        then monitor ×1, interrogation 2 subjects (parallel), integration check
wave 3  builders: units 1 (seam) ⇒ sequential by count
        then monitor ×1, interrogation 1 subject, integration check
```

Three plan lines, one per wave; 3 monitoring notes; 8 interrogation verdicts. Nothing about
this is re-decided when ST-005 returns late — it takes the freed slot, and the plan stands.

### QA — `standard`, 9 findings (2 CRITICAL, 3 HIGH, 4 MEDIUM)

```text
step 1  6 dimension units (5 + delta) ⇒ parallel, cap 6 ⇒ 6 agents
        + 1 security auditor in parallel (own artifact)
step 3  adversarial verifier: units = CRITICAL/HIGH only = 5 ⇒ parallel, cap 6 ⇒ 5 agents
        order = finding number asc; MEDIUMs get no verifier (advisory unless escalated)
        + 1 Master Agent monitor (review batch, sequential, after the batch closes)
step 5  test engineer: 5 categories (standard) ⇒ parallel, cap 6 ⇒ 5 agents
        debate: design surface only, ≤2 exchanges, strictly sequential
step 7  E2E verifier alone; step 8 evidence post; step 9 AC assessor; step 11 tally
step 12 auditor final audit subjects ⇒ parallel, cap 4, 1 round each
step 13 negotiation: one disputed AC at a time, ac-id asc, ≤1 exchange each
```

In `critical` the same step 5 row yields 8 categories: 6 dispatch, 2 queue.

### Delivery — `standard`

Row `Delivery 1`: 2 units. The Doc Writer edits `docs/**`, README, CHANGELOG; the Delivery
Agent commits the whole tree. The commit set is not disjoint from the doc set, so rule 4
applies:

```text
units  = doc-writer, delivery-agent-prep
proof  = commit set ⊇ doc set ⇒ NOT disjoint
plan   = sequential, documented order: doc-writer, then delivery-agent-prep
```

Then steps 2–4 sequential (1 agent), the Supervisor final report, and the phase boundary
audit — the two dispatches no mode and no table row ever removes.

### PR review — 9 changed files, `standard`

Merge-base diff: 5 source files (one of them a component whose `use-device-flags` helper
landed in the same PR), 2 renamed-only files, 2 pipeline YAML files. Finders raise 14
findings.

```text
phase 0  ground truth: git merge-base + git rev-parse; BASE/HEAD recorded as evidence
phase 1  pr1-file : 4 units (the component + its helper are ONE bundle, one agent)
                    ⇒ parallel, cap 6, order path asc
         pr1-sweep: 2 units (cosmetic = the 2 renames · config-e2e = the 2 YAMLs)
         pr1-dim  : 6 units ⇒ parallel, cap 6, dimension asc
         pr1-spec : 3 units (typescript · react · test-quality; security not triggered)
                    ⇒ probed against the runtime; react absent ⇒ pr-file-reviewer mode=lens
                    ⇒ parallel, cap 4, resolved agent name asc
phase 2  pr2-verify: 14 units (EVERY finding, not only CRITICAL/HIGH)
                    ⇒ parallel, cap 6 ⇒ 6 dispatched, 8 queued, finding id asc
                    each verified_by ≠ raised_by, asserted on the plan line
phase 3  pr3-cross: 1 unit, sequential, holds all 15 finder artifacts + all 14 verdicts
         pr3-unknowns: 1 unit, same role, own artifact — what SHOULD have changed and did not
phase 4  pr4-comments: 1 unit, sequential, last
```

Four plan lines, one per phase with a fan-out. In `fast` the same rows yield the same 4
per-file agents (the floor does not move), **1** merged sweep bundle, **2** dimension
specialists, **no** stack specialist lenses (no redline path in this diff) — and the
unknown-unknowns pass unchanged, because no mode removes it.
