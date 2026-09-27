# File-Scope Protocol

Disjoint file ownership is what makes parallel Construction safe.

## Ownership sets

Every story's frontmatter declares:

```yaml
file_scope:
  owns:            # existing files this story may edit (exact paths)
    - src/auth/login.py
    - tests/auth/test_login.py
  creates:         # directories where this story may add NEW files (dir prefixes)
    - src/auth/
```

## Rules

1. **Disjointness check (orchestrator, mechanical).** Before Construction, pairwise-intersect
   all ownership sets within each wave: exact-path collisions and `creates` prefix overlaps
   are violations. Violations return to the Epic Scoper (max 2 revisions); if still
   colliding, the orchestrator forces the colliding stories into separate waves and records
   a CONCERNS note.
2. **Seam stories.** Unavoidably-shared files (barrel exports, route registries, migration
   indexes) get exactly one designated seam story, scheduled solo in the final wave.
3. **Builder confinement.** A builder writes ONLY within its ownership set (plus appending
   to its own story file). Needing an outside file = STOP and report BLOCKED with the
   reason. Never grab the file. On Claude Code the `guard-scope` hook enforces this; on
   other runtimes it is protocol text checked by the spec-compliance reviewer and the
   Supervisor.
4. **Build Fixer exemption.** Integration breakage crosses ownership lines; the Build Fixer
   may touch any file but must report every file touched and why.
