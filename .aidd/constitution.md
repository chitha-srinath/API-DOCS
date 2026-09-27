# Project Constitution

The standing law of this repository. Every AIDD agent reads this before acting.
Filled in by the Master phase interview; edit anytime — changes apply to the next phase.

## Identity

- Project: API-DOCS
- Stack: TypeScript on Node.js (v24), npm
- Default branch: main

## Canonical commands

<!-- The Architect refines these per change; these are repo-level defaults. -->
- build: `npm run build` (tsc) — n/a until package.json exists
- test: `npm test` (vitest --coverage) — n/a until scaffolded
- lint: `npm run lint` (eslint) — n/a until scaffolded
- typecheck: `npx tsc --noEmit`
- e2e: n/a (no e2e suite yet)

## Quality bars

- Test coverage target: 90% (floor: target − 10)
- Mutation score floor: 70% (Stryker)
- Performance budgets: p95 endpoint latency 200ms
- Definition of Done: tests green · lint clean · docs updated · AC matrix all-PASS ·
  evidence captured pre+post · supervision compliant

## Standards

- Code style: eslint + prettier defaults; strict tsconfig
- Commit convention: Conventional Commits, grouped per story
- Security: no secrets in code; dependency audit must be clean of CRITICAL

## Integrations

- Jira write-back enabled: false
- CI provider: github-actions

## PR review

Per-repo settings for reviewing **external** pull requests (`/aidd:review-pr`, canonical
protocol `protocol/pr-review.md`). Every key has a default, so the capability works
with this block absent — edit only what your repo actually differs on.

```yaml
pr_review:
  platform: github                  # azure-devops | github | local (default: inferred from the remote)
  invariants_files:                 # the repo's written law, read by every finder
    - AGENTS.md
    - CLAUDE.md
    - .aidd/constitution.md
  dimension_agents:                 # this repo's specialist roster; default = AIDD's own six
    - correctness-types
    - framework-invariants
    - duplication-consistency
    - test-coverage
    - security
    - tenant-boundary
  roster: {}                        # stack-detected specialist lenses; {} = the shipped roster (pr-review.md §15)
                                    # e.g. typescript: isa-typescript-review · security: isa-appsec · a11y: null (disabled)
  framework_paths: []               # what counts as "framework code" (default: every added path)
  redline_patterns: []              # ripgrep patterns (default: the three shipped in pr-review.md §9.3)
  allowlist_file: null              # e.g. .framework-allowlist.json — the PR must not touch it
  ticket_system: none               # jira | azure-boards | github-issues | none
  post_comments: false              # NEVER true by default; posting also needs per-run human approval
  comment_style:
    address_author: false           # terse handle only; never a greeting
    max_lines: 4
```

- **Posting is an external write.** `post_comments: true` enables the capability; it never
  grants permission. Every run still stops and asks (`protocol/pr-review.md` §12), in both
  autonomy modes, exactly as Jira write-back does.
- A configured value the repo cannot satisfy (a glob matching nothing, a missing allowlist
  file) is recorded as a degradation with its reason — never silently dropped, never passed.
- **The roster is resolved against the runtime, not against this file.** Naming an agent under
  `roster:` says the repo wants it; a specialist the runtime does not expose degrades to
  `pr-file-reviewer` in `mode: lens` and the degradation is published in the report
  (`protocol/pr-review.md` §15.5). A missing agent never fails a review and never silently
  vanishes from one.
