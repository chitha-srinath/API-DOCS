# Progress Contract

Normative rules for what the orchestrator says to the user while a pipeline runs. The
decision tables, playbooks, and role files **are** the reasoning record; the user gets
state transitions only. Deliberation narrated at the user is noise that hides the one
thing they need — where the run is and what it needs from them.

## 1. The progress line

**One line per completed step, and nothing else.** Fixed format, machine-parseable and
human-scannable:

```text
[<phase> <step>/<total>] <what happened> · <evidence pointer> · gates: <k>/<n> · rigor: <mode> · next: <step name>
```

| Field | Meaning | When unavailable |
|---|---|---|
| `<phase>` | the change-state `phase` value, verbatim — or the literal `escape` for a run that sits outside the phase machine (`escape-analysis.md` §8) | never — a step outside a phase is not a step |
| `<step>/<total>` | the playbook's step number and that phase's step count — the numbered steps the playbook actually carries, so Construction's denominator is 4 and QA's is 17 | never — the playbook numbers its steps |
| `<what happened>` | the state transition, past tense, ≤10 words | never |
| `<evidence pointer>` | repo-relative path to the artifact or evidence block just written | `-` |
| `gates: <k>/<n>` | approved gates over gates defined for the change | `gates: 0/0` |
| `rigor: <mode>` | change-state `rigor.mode` (optional field) | `rigor: -` |
| `next: <step name>` | the next playbook step, or `gate <key>`, or `done` | never |

Rules:

- Separator is exactly ` · ` (space, middle dot, space). Field order is fixed.
- One line, no wrapping, no leading bullet, no emoji, no bold.
- The line is recorded verbatim as the change-state `history` `event` for that step
  (`protocol/state-protocol.md` rule 3 already requires the write) — which is what lets
  the dashboard replay progress and the Supervisor audit it.
- **No line for a step that did not change state.** A retry that produced nothing, a
  re-read, a no-op validation: silent. The line is a state-transition record, not a
  heartbeat.

Example — `30-construction.md` numbers **4** steps, and writing a story's red tests happens
inside step 2 (the per-wave loop), so the line reads `2/4`:

```text
[construction 2/4] ST-002 red tests written · changes/2026-07-29-user-auth/stories/ST-002.md · gates: 2/4 · rigor: standard · next: ST-002 implementation
```

## 2. Blocked and failed lines

A distinct fixed shape, so a blocked run can never be mistaken for a progressing one:

```text
[<phase> <step>/<total>] BLOCKED: <reason> · remediation: <what the playbook prescribes> · evidence: <path> · next: <what unblocks it>
```

- `BLOCKED` when `phase_status: blocked` (budget exhausted, missing prerequisite, forced
  human gate). `FAILED` in the same shape when a step's verification failed and the
  playbook's fix loop takes over.
- `<reason>` is the change-state `blocked_reason`, verbatim.
- `remediation` names the playbook step or protocol rule that resolves it — never an
  invented workaround, never a guess. If the playbook prescribes nothing, that is itself
  the escalation and the line says so.

## 3. Forbidden output

Never sent to the user:

- Deliberation about **how many agents** to use, **which model**, or whether to
  **parallelize**. The playbook's dispatch table already decided.
- Re-litigating a decided plan, re-opening an approved gate, or second-guessing a
  recorded verdict.
- Restating the playbook back to the user — no step list echoes, no "here is my plan to
  follow the plan", no summarizing a file the user can open.
- Apologies, self-assessment, enthusiasm, and filler ("Great question", "Let me now…").
- Progress lines for steps that did not change state, and duplicate lines for one step.
- Raw subagent transcripts. The report artifact is the deliverable; its path is the
  evidence pointer.

## 4. Where deliberation goes instead

- **Dispatch reasoning and role traffic** → `supervision/audit.log` (automatic on Claude
  Code via the Task hook; a protocol duty elsewhere).
- **Analysis, trade-offs, findings, rejected options** → the phase's report artifacts
  (`pre-review/*`, `qa/*`, `audit/*`, `supervision/<phase>-report.md`).
- **Nothing is lost, it is filed.** The audit trail is the reasoning record; the terminal
  is the state channel.

## 5. Gate prompts — the one place for prose

A gate ask is the only user-facing text that is not a progress line, and it is capped at
**five lines**:

1. what was built
2. what proves it
3. what is at risk
4. the decision requested (`approve` · `revise: <notes>` · `abort`)
5. the artifact path

The ≤20-line gate digest (`protocol/gates.md`) is the artifact, not the message: the ask
points at it. In `take-care` an auto-approved gate emits a progress line with
`next: <step>` and no prose at all.

## 6. The dashboard is the detail surface

The terminal gets the line; `.aidd/dashboard.html` gets the depth. Regenerate it after
every state write (`bash .aidd/framework/scripts/render-dashboard.sh` — already required
by `protocol/state-protocol.md`); its **Recent progress** section replays the last progress
lines from the change's history, alongside gates, quality gates, stories, and supervision
verdicts. When a user wants more than the line, the answer is the dashboard path — not a
longer message.

## 7. Conformance checklist

- [ ] Every completed step emitted exactly one line, in the format above.
- [ ] No line was emitted for a step that changed no state.
- [ ] Every line's evidence pointer resolves to a file on disk (or is `-`).
- [ ] No forbidden output (§3) reached the user.
- [ ] Every gate ask is ≤5 lines and names the artifact path.
