# State Protocol

Normative rules for reading and writing AIDD state. Every runtime follows these exactly.

## Files

- `.aidd/state.yaml` — global registry (schema: `core/schemas/state.schema.json`)
- `.aidd/changes/<id>/state.yaml` — per-change state machine (schema: `core/schemas/change-state.schema.json`)

## Rules

1. **Single writer.** Only the orchestrator (the main session) writes state files. Subagents
   report through their own artifacts (story frontmatter `status:`, findings files, reports);
   the orchestrator folds results into state. This eliminates concurrent-write corruption
   during parallel Construction.
2. **Write-then-rename.** Write to `state.yaml.tmp`, then rename over `state.yaml` so the
   file is never observed torn.
3. **Update after every completed step, before starting the next.** The `step` breadcrumb
   is what makes resume exact.
4. **Validate after every write.** Run
   `python3 .aidd/framework/scripts/aidd-validate.py .aidd/framework/schemas/change-state.schema.json <file>`
   (on Claude Code a PostToolUse hook does this automatically; elsewhere the playbook
   requires self-validation). A nonconforming state file must be fixed before proceeding.
5. **Strict phase order.** document(optional, once) → master(once) → inception →
   construction → qa → delivery → retro → done. A phase refuses to run unless the prior
   phase is `complete` and its gates are `approved` (or auto-approved).
6. **Timestamps** are ISO-8601 UTC seconds: `2026-07-29T14:12:00Z`.

## Resume

On start, if any change has `phase_status != complete` for its current phase:

1. Verify every entry in each gate's `artifacts` list against disk, including newly added
   files in the gate's bound directories. Legacy single-file `artifact_sha256` entries
   remain readable, but cannot cover multi-file gates. A mismatch or unbound file flips
   the gate to `stale` (see `gates.md`).
2. Revert any story with `status: in_progress` to `ready` (keep partial diffs in place; the
   re-dispatched builder reconciles or reverts its owned files).
3. **Re-prove, never trust:** re-run the current phase's verification commands to establish
   ground truth before continuing.
4. Continue from the first unmet exit criterion. Resume is idempotent — safe to invoke
   repeatedly.

## Bounded loops

Every retry loop has a budget (default 3: story attempts, build-fix attempts, QA fix
iterations). Exhaustion sets `phase_status: blocked` + `blocked_reason` and stops — in both
autonomy modes. `take-care` means "no approval stops", never "loop forever".
