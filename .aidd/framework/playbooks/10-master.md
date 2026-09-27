# Phase: Master

Purpose: establish the standing law and memory of the repo. Runs once (re-runnable to
refresh).

## Steps

1. Load `learnings.md` and `memory.md` if present (`../protocol/learning.md`).
2. **Repo facts probe** (read-only): stack, package manager, test runner, CI config,
   default branch. Record in `memory.md`.
3. **Constitution interview**: fill `constitution.md` from the template.
   - `let-me-look`: ask the human each unknown (stack rules, quality bars, budgets).
   - `take-care`: derive defaults from repo evidence; log each as an assumption in
     `memory.md` → Decisions.
4. Probe the canonical commands actually run (e.g. `--help`, listing tests). Broken
   commands are fixed in conversation with the human or recorded as `n/a` with reason.
5. Seed/refresh `.aidd/state.yaml` (`constitution: present`).
6. Brownfield with no `.aidd/specs/`? Offer/queue `05-document.md`.

## Exit checklist

- [ ] constitution.md complete — no `<placeholders>` remain
- [ ] memory.md has repo facts
- [ ] state.yaml valid (schema) and `constitution: present`

## Supervisor checklist

- Interview answers or evidence-backed defaults recorded for every constitution field.
- Canonical commands probed with evidence blocks.
