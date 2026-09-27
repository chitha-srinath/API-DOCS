# Phase: Document (brownfield onboarding — optional, once)

Purpose: mine behavioral specs from an existing codebase so later changes never regress
unwritten behavior.

## Steps

1. Orchestrator maps capabilities (top-level features/modules) from the repo — a list of
   ≤12 capability names with entry-point paths.
2. Fan out Spec Miner (`../roles/spec-miner.md`), one per capability (cap 6; sequential
   fallback: alphabetical) → `.aidd/specs/<capability>.md` from `templates/mined-spec.md`.
3. Orchestrator indexes results in `memory.md` and flags every invariant with
   `enforced by: nothing` as a standing risk.
4. **Supervisor audit**.

## Exit checklist

- [ ] every mapped capability has a mined spec with file/test anchors
- [ ] unenforced invariants flagged in memory.md
