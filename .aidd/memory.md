# Project Memory

Long-lived facts agents should know. Maintained by the orchestrator; pruned by humans.

## Decisions

<!-- date — decision — why -->
- 2026-09-27 — Stack TS+Node/npm, Strict bars (90% cov, 70% mutation, p95 200ms), main + GitHub Actions — user interview answers.

## Glossary

<!-- term — meaning in this repo -->

## Known constraints

<!-- e.g. "payments module is frozen until Q3 audit" -->

## Health

<!-- Retro-maintained: stale facts, contradicted decisions, dangling citations to verify or prune. -->

## Repo facts (Master, 2026-09-27)

- Greenfield: no source yet; only AGENTS.md, .gitignore, .claude/settings.json.
- Toolchain: node v24.11.1, npm 11.4.2, git 2.33.1. Python NOT installed (AIDD installer warns; non-fatal).
- Git initialized 2026-09-27, default branch `main`. CI: GitHub Actions (no workflow yet).
- Canonical commands are planned, not yet runnable — first change must scaffold package.json.
