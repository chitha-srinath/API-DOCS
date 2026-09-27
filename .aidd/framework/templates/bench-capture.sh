#!/usr/bin/env bash
# AIDD bench capture template. Usage: bench-capture.sh <pre|post> <bench-id> -- <command...>
# Records wall-clock over 3 runs into evidence/<stage>/bench-<id>.txt
set -euo pipefail
stage="$1"; bench_id="$2"; shift 3   # consumes <stage> <id> --
out="evidence/${stage}/bench-${bench_id}.txt"
mkdir -p "evidence/${stage}"
{
  echo "bench: ${bench_id}"
  echo "command: $*"
  for i in 1 2 3; do
    start=$(python3 -c 'import time; print(time.time())')
    "$@" >/dev/null 2>&1 || echo "run ${i}: NONZERO EXIT"
    end=$(python3 -c 'import time; print(time.time())')
    python3 -c "print(f'run ${i}: {${end}-${start}:.3f}s')"
  done
} | tee "${out}"
