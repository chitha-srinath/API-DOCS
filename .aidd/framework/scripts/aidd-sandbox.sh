#!/usr/bin/env bash
# Run an agent-issued command inside a disposable container, so a generated
# command cannot damage the host working tree.
#
# The threat is not malice, it is confident wrongness: an agent that writes
# `rm -rf "${BUILD_DIR}"` with BUILD_DIR unset is one expansion away from the
# user's home directory. Containment is cheaper than trust.
#
# Degradation is loud and explicit (protocol/evidence.md). No container runtime
# means the command still runs — on the host, with a warning on stderr and a
# reason to record — unless AIDD_SANDBOX_REQUIRED=1, which turns that same
# situation into a hard failure. A silent fallback is the one unacceptable
# outcome: the caller would believe it was isolated when it was not.
#
# Usage:  aidd-sandbox.sh [--network] [--writable] -- <command> [args...]
#         AIDD_SANDBOX=off aidd-sandbox.sh -- pytest -q     # explicit opt-out
#
# Exit code is the command's own. Sandbox-level failures use 125, distinct from
# any plausible test exit code, so a caller can tell "the sandbox broke" from
# "the tests failed".
set -uo pipefail

IMAGE="${AIDD_SANDBOX_IMAGE:-docker.io/library/debian:stable-slim}"
MEMORY="${AIDD_SANDBOX_MEMORY:-2g}"
PIDS="${AIDD_SANDBOX_PIDS:-512}"
NETWORK="none"
MOUNT_MODE="ro"

while [ $# -gt 0 ]; do
  case "$1" in
    --network)  NETWORK="bridge"; shift ;;
    --writable) MOUNT_MODE="rw"; shift ;;
    --)         shift; break ;;
    *)          break ;;
  esac
done

if [ $# -eq 0 ]; then
  echo "aidd-sandbox: no command given" >&2
  exit 125
fi

CMD=("$@")
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$(pwd)"

warn() { echo "aidd-sandbox: $*" >&2; }

degrade_to_host() { # reason — run on the host, loudly, or refuse when required
  if [ "${AIDD_SANDBOX_REQUIRED:-0}" = "1" ]; then
    warn "REQUIRED sandbox unavailable ($1) — refusing to run on the host"
    exit 125
  fi
  warn "DEGRADED — running on the HOST, not in a sandbox. Reason: $1"
  warn "DEGRADED — record this in the run's degradations (protocol/evidence.md)"
  "${CMD[@]}"
  exit $?
}

if [ "${AIDD_SANDBOX:-on}" = "off" ]; then
  warn "disabled by AIDD_SANDBOX=off — running on the host by explicit request"
  "${CMD[@]}"
  exit $?
fi

RUNTIME=""
for candidate in podman docker; do
  if command -v "${candidate}" >/dev/null 2>&1; then RUNTIME="${candidate}"; break; fi
done

[ -n "${RUNTIME}" ] || degrade_to_host "no podman or docker on PATH"
"${RUNTIME}" info >/dev/null 2>&1 || degrade_to_host "${RUNTIME} found but not responding"

warn "sandboxed: ${RUNTIME} · image ${IMAGE} · network ${NETWORK} · repo ${MOUNT_MODE} · mem ${MEMORY}"

# --rm             disposable by construction, not by cleanup
# --network none   no exfiltration path, and no flaky-network test failures
# :ro (default)    a run that needs to write must ask for it (--writable)
# --pids-limit     a fork bomb in a generated command stays bounded
# --user           never root inside, so a :rw mount keeps host file ownership
"${RUNTIME}" run --rm \
  --network "${NETWORK}" \
  --memory "${MEMORY}" \
  --pids-limit "${PIDS}" \
  --user "$(id -u):$(id -g)" \
  --workdir /work \
  --volume "${ROOT}:/work:${MOUNT_MODE}" \
  --env HOME=/tmp \
  "${IMAGE}" \
  sh -c 'exec "$@"' _ "${CMD[@]}"
exit $?
