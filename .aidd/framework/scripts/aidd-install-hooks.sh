#!/usr/bin/env bash
# Install (or remove) AIDD's git hooks, so review runs on the developer's own
# machine at the moment the change is made rather than when someone remembers
# to ask for it.
#
# Three properties this must have, because a hook missing any one of them gets
# deleted by the first developer it annoys:
#   opt-in     - nothing is installed until someone runs this
#   idempotent - running it twice leaves one hook, not two
#   reversible - `--uninstall` restores whatever was there before
#
# An existing non-AIDD pre-commit hook is preserved (moved aside and chained),
# never overwritten: silently eating another tool's hook is how a framework
# loses a repo's trust.
#
# Usage: aidd-install-hooks.sh [--uninstall]
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "aidd-hooks: not a git repo" >&2; exit 1; }
HOOK_DIR="$(git rev-parse --git-path hooks 2>/dev/null)" || HOOK_DIR="${ROOT}/.git/hooks"
case "${HOOK_DIR}" in /*) ;; *) HOOK_DIR="${ROOT}/${HOOK_DIR}" ;; esac
HOOK="${HOOK_DIR}/pre-commit"
PRIOR="${HOOK_DIR}/pre-commit.pre-aidd"
MARKER="AIDD pre-commit hook"

UNINSTALL=0
for arg in "$@"; do
  case "${arg}" in
    --uninstall) UNINSTALL=1 ;;
    *) echo "aidd-hooks: unknown argument '${arg}'" >&2; exit 2 ;;
  esac
done

if [ "${UNINSTALL}" = "1" ]; then
  if [ -f "${HOOK}" ] && grep -qF "${MARKER}" "${HOOK}" 2>/dev/null; then
    rm -f "${HOOK}"
    if [ -f "${PRIOR}" ]; then
      mv "${PRIOR}" "${HOOK}"
      echo "aidd-hooks: removed; restored the pre-existing pre-commit hook"
    else
      echo "aidd-hooks: removed"
    fi
  else
    echo "aidd-hooks: nothing to remove (no AIDD hook installed)"
  fi
  exit 0
fi

mkdir -p "${HOOK_DIR}"

# Idempotence + preservation: our own hook is replaced; a foreign one is chained.
if [ -f "${HOOK}" ] && ! grep -qF "${MARKER}" "${HOOK}" 2>/dev/null; then
  mv "${HOOK}" "${PRIOR}"
  echo "aidd-hooks: existing pre-commit hook preserved and chained"
fi

cat > "${HOOK}" <<'HOOK_BODY'
#!/usr/bin/env bash
# AIDD pre-commit hook
# Fast local gate. Blocking findings exit non-zero; everything advisory is
# printed and ignored. Bypass once with `git commit --no-verify`, or remove
# permanently with `.aidd/framework/scripts/aidd-install-hooks.sh --uninstall`.
set -uo pipefail

[ "${AIDD_HOOK:-on}" = "off" ] && exit 0

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
prior="$(git rev-parse --git-path hooks 2>/dev/null)/pre-commit.pre-aidd"
[ -x "${prior}" ] && { "${prior}" "$@" || exit $?; }

scripts="${root}/.aidd/framework/scripts"
[ -d "${scripts}" ] || scripts="${root}/core/scripts"
[ -d "${scripts}" ] || exit 0

staged="$(git diff --cached --name-only --diff-filter=ACM)"
[ -n "${staged}" ] || exit 0

status=0

# 1. Routing config must never carry a credential. Blocking: a committed key
#    is not recoverable by editing the next commit.
if printf '%s\n' "${staged}" | grep -q '^\.aidd/config\.json$' && [ -f "${scripts}/aidd-route.sh" ]; then
  bash "${scripts}/aidd-route.sh" audit || status=1
fi

# 2. Refresh the symbol index for staged files so the next dispatch reads a
#    current map. Advisory: an index refresh must never block a commit.
if [ -f "${scripts}/aidd-index.py" ]; then
  args=""
  for f in ${staged}; do args="${args} --file ${f}"; done
  # shellcheck disable=SC2086
  python3 "${scripts}/aidd-index.py" --quiet ${args} >/dev/null 2>&1 || true
fi

exit ${status}
HOOK_BODY

chmod +x "${HOOK}"
echo "aidd-hooks: installed ${HOOK}"
echo "aidd-hooks: bypass once with 'git commit --no-verify'; remove with --uninstall"
