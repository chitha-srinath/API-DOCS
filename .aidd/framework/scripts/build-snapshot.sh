#!/usr/bin/env bash
# Build the AIDD repo-level snapshot context pack under .aidd/context/.
# Usage: build-snapshot.sh [tag]      e.g. post-wave-1, pre-inception (default: manual)
# Zero hard dependencies (ADR 002): bash + git + python3 stdlib optional.
# Output is gitignored and NEVER committed; rebuilt each iteration and on resume.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "build-snapshot: not a git repo" >&2; exit 1; }
CTX="${ROOT}/.aidd/context"
TAG="${1:-manual}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "${CTX}"

ev() { # evidence block: command + trimmed output + exit code (evidence protocol)
  echo '```'
  echo "\$ $*"
  out="$("$@" 2>&1 | head -40)"; code=$?
  echo "${out}"
  echo "[exit ${code}] ${STAMP}"
  echo '```'
}

# ── snapshot.md: repo tree + module map + public API surface + entry points ──
{
  echo "# Repo snapshot — ${STAMP} (${TAG})"
  echo
  echo "## Tracked tree (top 500)"
  echo '```'
  git -C "${ROOT}" ls-files | head -500
  echo '```'
  echo
  echo "## Module map (files per extension)"
  echo '```'
  git -C "${ROOT}" ls-files | awk -F. 'NF>1 {print $NF}' | sort | uniq -c | sort -rn | head -20
  echo '```'
  echo
  echo "## Public API surface"
  echo '```'
  # Best-effort and language-agnostic: exported / public symbol declarations in tracked
  # text files (-I skips binaries). Not a parse — a reading aid for structure-fit review.
  api="$(git -C "${ROOT}" grep -InE '^[[:space:]]*(export |def |func |public |pub |class |module\.exports)' -- . 2>/dev/null \
    | grep -vE '^[^:]*\.(md|markdown|txt):' | head -60)"
  echo "${api:-(none detected)}"
  echo '```'
  echo
  echo "## Entry points / manifests"
  echo '```'
  git -C "${ROOT}" ls-files | grep -Ei '(^|/)((package|pyproject|cargo|go|pom)\.(json|toml|mod|xml)|makefile|justfile|main\.[a-z]+|index\.[a-z]+|setup\.(py|cfg))$' || echo "(none detected)"
  echo '```'
} > "${CTX}/snapshot.md"

# ── quality-baseline.md: measured sigmas, every number with its command ─────
# Canonical coverage/lint commands are declared in architecture.md; this script never
# guesses or runs project commands (ADR 002 zero-dep). The Coverage and Lint sections
# below ALWAYS emit an explicit row, so a sigma this script cannot measure is visible
# as `na` with its reason — degradation is explicit, never silent.
ARCH=""
for cand in "${ROOT}"/.aidd/changes/*/architecture.md "${ROOT}/architecture.md"; do
  [ -f "${cand}" ] || continue
  ARCH="${cand}"
  break
done
ARCH_REL="${ARCH#"${ROOT}/"}"

sigma_row() { # <sigma-name>: one explicit row, plus the pointer when architecture.md names it
  echo "$1: na (no canonical command available to this script)"
  if [ -n "${ARCH}" ] && grep -qiE "$1" "${ARCH}" 2>/dev/null; then
    echo
    echo "\`${ARCH_REL}\` mentions $1 — the orchestrator appends the measured evidence"
    echo "block per context-snapshots.md, or records na."
  fi
}

{
  echo "# Quality baseline — ${STAMP} (${TAG})"
  echo
  echo "## Test files"
  ev bash -c "git -C '${ROOT}' ls-files | grep -Eic '(^|/)(tests?|spec)/|[._-](test|spec)\.' || true"
  echo "## Repo size (tracked files)"
  ev bash -c "git -C '${ROOT}' ls-files | wc -l"
  echo "## Largest files (complexity hotspots proxy)"
  ev bash -c "git -C '${ROOT}' ls-files -z | xargs -0 wc -l 2>/dev/null | sort -rn | head -11 | tail -10"
  echo "## TODO/FIXME markers"
  ev bash -c "git -C '${ROOT}' grep -nE 'TODO|FIXME' -- . 2>/dev/null | wc -l || true"
  echo
  echo "## Coverage"
  sigma_row coverage
  echo
  echo "## Lint"
  sigma_row lint
  echo
  echo "Project-specific sigmas (coverage %, lint, mutation) come from the canonical"
  echo "commands in architecture.md when a change is active; this script never runs them"
  echo "(zero-dep), so the two sections above carry an explicit \`na\` row until the"
  echo "orchestrator appends the measured evidence block — degradation is explicit."
} > "${CTX}/quality-baseline.md"

# ── delta.md: churn since previous snapshot ─────────────────────────────────
LAST_REF=""
[ -f "${CTX}/.last-ref" ] && LAST_REF="$(cat "${CTX}/.last-ref")"
{
  echo "# Context delta — ${STAMP} (${TAG})"
  echo
  echo "## Delta since previous snapshot (${LAST_REF:-none})"
  echo '```'
  if [ -n "${LAST_REF}" ] && git -C "${ROOT}" rev-parse -q --verify "${LAST_REF}" >/dev/null; then
    git -C "${ROOT}" diff --stat "${LAST_REF}" HEAD | tail -30
  else
    echo "(first snapshot — no previous ref)"
  fi
  echo '```'
  echo
  echo "## Working tree"
  echo '```'
  git -C "${ROOT}" status --short | head -30
  [ -z "$(git -C "${ROOT}" status --short)" ] && echo "(clean)"
  echo '```'
} > "${CTX}/delta.md"
git -C "${ROOT}" rev-parse HEAD > "${CTX}/.last-ref"

# ── history trail ───────────────────────────────────────────────────────────
HIST="${CTX}/history/${STAMP}-${TAG}"
mkdir -p "${HIST}"
cp "${CTX}/snapshot.md" "${CTX}/quality-baseline.md" "${CTX}/delta.md" "${HIST}/"

# ── index.json: the dual-state symbol map ───────────────────────────────────
# The prose pack above tells a role what the repo *is*; the index tells it
# where every symbol *lives*, so the role pulls spans instead of whole files
# (protocol/context-index.md). Advisory: a failed index never fails a snapshot.
INDEXER="$(dirname "$0")/aidd-index.py"
if [ -f "${INDEXER}" ] && command -v python3 >/dev/null 2>&1; then
  if python3 "${INDEXER}" --root "${ROOT}" --out "${CTX}/index.json" --quiet 2>/dev/null; then
    echo "index: built at ${CTX}/index.json"
  else
    echo "index: na (indexer failed; roles fall back to reading files)"
  fi
else
  echo "index: na (no indexer or python3; roles fall back to reading files)"
fi

echo "snapshot pack built: ${CTX} (history: ${HIST})"
