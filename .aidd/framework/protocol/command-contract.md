# Command Contract

Normative rules for what an AIDD command is, and what the orchestrator must do before it
reasons about one. This protocol exists because two failure modes were observed in the
field: a session treated a **skill name** as if it were a command, and a session
**invented orchestration** around a real command instead of loading the playbook that
command binds to.

## 1. Only manifest commands exist

`.aidd/framework/scripts/aidd-commands.txt` is the manifest — one row per supported
command, `<command>|<playbook-or-protocol path>|<one-line purpose>`. It is derived
mechanically from the plugin's `commands/` directory and is the single source of truth.

- A token of the form `/aidd:<name>` is a command **only** if `<name>` has a manifest row.
- There are no hidden, implied, or composite commands. `/aidd:go` is not "run the other
  commands in sequence" — it is the row that binds to `playbooks/00-pipeline.md`.
- Non-Claude runtimes have the same surface via `prompts/`: the manifest row still names
  the file to load.

## 2. Skills are not commands

AIDD ships five skills — `aidd-pipeline`, `aidd-state`, `aidd-gates`,
`aidd-supervision`, `aidd-pr-review`. They are **instruction sets the orchestrator loads**,
not entry points a user runs.

- **Forbidden:** treating a skill name as a command. `/aidd:aidd-supervision`,
  `/aidd:aidd-pipeline`, `/aidd:aidd-state`, `/aidd:aidd-gates`, `/aidd:aidd-pr-review` are
  not commands and never were; no manifest row exists for any of them. The PR-review
  capability's command is `/aidd:review-pr`, which the binding table below names.
- Invoking the skill itself is legitimate. What is forbidden is the inference that,
  because a skill exists, a matching command exists — and then improvising the phase logic
  that "command" would have run.
- A skill tells you *how* to behave. A command's playbook tells you *what steps to
  execute*. Loading a skill is never a substitute for loading the playbook.

## 3. Load before reason

For any command, the orchestrator MUST read the exact file the manifest row names —
verbatim, from disk — **before** producing any plan, any clarifying question, any state
write, or any subagent dispatch.

- The failure mode being prevented is **improvised phase logic**: a plausible-sounding
  sequence of steps invented from the command's name, which skips roles, gates, and
  evidence duties that the playbook mandates.
- **Reasoning that precedes the load is a supervision violation** (`protocol/supervision.md`):
  the orchestrator's own conduct is audited, and "planned before loading the playbook" is
  itemized like any other breach — the step re-runs after the load.
- The load is not satisfied by memory of a previous session, by the command file's summary
  line, or by a skill's description. Read the file.
- If the named file is absent, the repo is not initialized or the vendored framework is
  stale: STOP and say so (`/aidd:init` or `/aidd:upgrade`). Never substitute improvisation
  for a missing playbook.

## 4. No improvisation

If the user asks for something no manifest row covers:

1. Name the closest supported command and what it will do.
2. Stop. Wait for the user to choose.

Never invent a phase, a gate key, a quality gate, a role, or an agent flow to cover the
gap. The phase set is fixed by `protocol/state-protocol.md`; the gate set is fixed by
`protocol/gates.md`; the roles are exactly the files in `roles/`. A capability that does
not exist in those files does not exist.

## 5. Unknown-command handling

An unrecognized `/aidd:<name>`:

- is **rejected**, not guessed. Do not infer intent from the name, and do not run the
  command you assume was meant.
- is answered with the manifest's nearest match plus that row's purpose, and nothing else
  happens until the user confirms.
- On Claude Code the `guard-command` PreToolUse hook enforces this mechanically: it denies
  the tool call and returns the nearest match. The hook is belt-and-braces — this protocol
  is the primary control, and it binds on every runtime.

## 6. Command → playbook binding

Generated from the manifest; `tests/commands.test.sh` asserts this table and
`aidd-commands.txt` stay in sync.

| Command | Loads before reasoning | Purpose |
|---|---|---|
| `/aidd:approve` | `.aidd/framework/protocol/gates.md` | Approve the currently pending AIDD gate |
| `/aidd:construct` | `.aidd/framework/playbooks/30-construction.md` | Run the AIDD Construction phase |
| `/aidd:cost` | `.aidd/framework/protocol/cost-governance.md` | Report AIDD cost — ledger summary, projection, and threshold status |
| `/aidd:dashboard` | `.aidd/framework/scripts/render-dashboard.sh` | Regenerate and show the AIDD dashboard |
| `/aidd:deliver` | `.aidd/framework/playbooks/50-delivery.md` | Run the AIDD Delivery phase |
| `/aidd:document` | `.aidd/framework/playbooks/05-document.md` | Run the AIDD Document phase (brownfield spec mining) |
| `/aidd:escape` | `.aidd/framework/protocol/escape-analysis.md` | Analyze a defect that escaped to production — which layer went blind, and what changes |
| `/aidd:go` | `.aidd/framework/playbooks/00-pipeline.md` | Run the full AIDD pipeline for an intent (or Jira key) |
| `/aidd:impact` | `.aidd/framework/roles/impact-analyst.md` | Run AIDD impact analysis — blast radius through multiple lenses |
| `/aidd:inception` | `.aidd/framework/playbooks/20-inception.md` | Run the AIDD Inception phase for an intent |
| `/aidd:init` | `install.sh` | Install/refresh AIDD in this repo, then run the Master interview if needed |
| `/aidd:master` | `.aidd/framework/playbooks/10-master.md` | Run/refresh the AIDD Master phase (constitution + memory) |
| `/aidd:mode` | `.aidd/framework/protocol/autonomy-modes.md` | Set AIDD autonomy mode (take-care or let-me-look) |
| `/aidd:qa` | `.aidd/framework/playbooks/40-qa.md` | Run the AIDD QA phase |
| `/aidd:resume` | `.aidd/framework/prompts/resume.md` | Resume the active AIDD change from recorded state |
| `/aidd:review-pr` | `.aidd/framework/protocol/pr-review.md` | Review an external pull request — two-phase, adversarially verified, nothing posted without approval |
| `/aidd:revise` | `.aidd/framework/protocol/gates.md` | Send the pending AIDD gate back with feedback |
| `/aidd:rigor` | `.aidd/framework/protocol/rigor-modes.md` | Set or report AIDD rigor mode (fast, standard, or critical) |
| `/aidd:status` | `.aidd/framework/prompts/status.md` | Show AIDD pipeline status |
| `/aidd:test` | `.aidd/framework/roles/test-engineer.md` | Run the AIDD test-engineer team — exhaustive test design + execution |
| `/aidd:upgrade` | `install.sh` | Re-vendor the AIDD framework in this repo from the installed plugin |

## 7. Conformance checklist

Before the first line of output on any AIDD command:

- [ ] The invoked token has a manifest row (else: reject with the nearest match, stop).
- [ ] The row's file was read from disk in this session.
- [ ] No plan, question, dispatch, or state write happened before that read.
- [ ] Output follows `protocol/progress.md` — progress lines, not deliberation.
