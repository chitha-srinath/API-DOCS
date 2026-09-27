#!/usr/bin/env bash
# Resolve which model a dispatch class runs on, and what it costs.
#
# One frontier model for every dispatch is the easy default and the expensive
# one: a mechanical rename does not need the reasoning an adversarial
# verification does. This reads the repo's routing table and answers the three
# questions the orchestrator asks per dispatch — which model, at what effort,
# at what rate — so the cost ledger records what was actually spent rather than
# one blended guess.
#
# Config surface: `.aidd/config.json` (see core/templates/config.json).
# The split from constitution.md is deliberate and load-bearing: constitution.md
# holds policy a human must approve (budgets, gates, rigor). config.json holds
# machine-tunable routing a script may read on every dispatch. Anything that
# changes what the framework *permits* stays in constitution.md.
#
# Credentials are never read from, or written to, this file — see `audit`.
#
# Usage:
#   aidd-route.sh model <dispatch-class>     # model id (falls back to default)
#   aidd-route.sh effort <dispatch-class>    # effort hint, or "-"
#   aidd-route.sh rate <model-id>            # "<in_per_mtok> <out_per_mtok>"
#   aidd-route.sh cost <model-id> <in> <out> # USD for a dispatch, 6dp
#   aidd-route.sh table                      # every class, resolved
#   aidd-route.sh audit                      # fail if config carries a secret
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$(pwd)"
CONFIG="${AIDD_CONFIG:-${ROOT}/.aidd/config.json}"

die() { echo "aidd-route: $*" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || die "python3 required (ADR 002 stdlib-only)"

py() { AIDD_ROUTE_CONFIG="${CONFIG}" python3 - "$@"; }

cmd="${1:-}"
[ -n "${cmd}" ] || die "usage: aidd-route.sh model|effort|rate|cost|table|audit ..."

case "${cmd}" in
  model|effort)
    [ $# -ge 2 ] || die "usage: aidd-route.sh ${cmd} <dispatch-class>"
    py "${cmd}" "$2" <<'PY'
import json, os, sys
what, klass = sys.argv[1], sys.argv[2]
try:
    cfg = json.load(open(os.environ["AIDD_ROUTE_CONFIG"], encoding="utf-8"))
except (OSError, ValueError):
    cfg = {}
models = cfg.get("models", {}) if isinstance(cfg, dict) else {}
route = (models.get("routes") or {}).get(klass) or {}
if what == "model":
    # An unmapped class falls back to the declared default rather than failing:
    # a routing gap must never be able to stop a run.
    print(route.get("model") or models.get("default") or "claude-opus-5")
else:
    print(route.get("effort") or "-")
PY
    ;;
  rate)
    [ $# -ge 2 ] || die "usage: aidd-route.sh rate <model-id>"
    py "$2" <<'PY'
import json, os, sys
model = sys.argv[1]
try:
    cfg = json.load(open(os.environ["AIDD_ROUTE_CONFIG"], encoding="utf-8"))
except (OSError, ValueError):
    cfg = {}
rate = ((cfg.get("models") or {}).get("rates") or {}).get(model)
if not rate:
    # No configured rate reports `na`, never 0.0 — a zero in a measurement
    # column reads as "free", which is the one thing it never is
    # (cost-governance.md: never park an estimate in a measured column).
    print("na na")
else:
    print("%s %s" % (rate.get("in_per_mtok", "na"), rate.get("out_per_mtok", "na")))
PY
    ;;
  cost)
    [ $# -ge 4 ] || die "usage: aidd-route.sh cost <model-id> <in-tokens> <out-tokens>"
    py "$2" "$3" "$4" <<'PY'
import json, os, sys
model, tin, tout = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    cfg = json.load(open(os.environ["AIDD_ROUTE_CONFIG"], encoding="utf-8"))
except (OSError, ValueError):
    cfg = {}
rate = ((cfg.get("models") or {}).get("rates") or {}).get(model)
try:
    tin_f, tout_f = float(tin), float(tout)
except ValueError:
    print("na"); raise SystemExit(0)
if not rate or "in_per_mtok" not in rate or "out_per_mtok" not in rate:
    print("na")
else:
    usd = (tin_f / 1e6) * float(rate["in_per_mtok"]) + (tout_f / 1e6) * float(rate["out_per_mtok"])
    print("%.6f" % usd)
PY
    ;;
  table)
    py <<'PY'
import json, os
try:
    cfg = json.load(open(os.environ["AIDD_ROUTE_CONFIG"], encoding="utf-8"))
except (OSError, ValueError):
    cfg = {}
models = cfg.get("models", {}) if isinstance(cfg, dict) else {}
default = models.get("default") or "claude-opus-5"
rates = models.get("rates") or {}
routes = models.get("routes") or {}
print("| dispatch class | model | effort | $/Mtok in | $/Mtok out |")
print("|---|---|---|---|---|")
for klass in sorted(routes):
    r = routes.get(klass) or {}
    m = r.get("model") or default
    rate = rates.get(m) or {}
    print("| `%s` | `%s` | %s | %s | %s |" % (
        klass, m, r.get("effort") or "-",
        rate.get("in_per_mtok", "na"), rate.get("out_per_mtok", "na")))
print()
print("default: `%s`" % default)
PY
    ;;
  audit)
    # Routing config is committed. A credential here would be committed with it,
    # so the shape is rejected outright rather than trusted to reviewer attention.
    py <<'PY'
import json, os, re, sys
path = os.environ["AIDD_ROUTE_CONFIG"]
if not os.path.exists(path):
    print("aidd-route: no config at %s (defaults apply)" % path); raise SystemExit(0)
raw = open(path, encoding="utf-8").read()
SECRET_KEY = re.compile(r'"[^"]*(api[_-]?key|secret|token|password|credential|authorization)[^"]*"\s*:', re.I)
SECRET_VAL = re.compile(r'"(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})"')
bad = [m.group(0) for m in SECRET_KEY.finditer(raw)]
bad += [m.group(0)[:12] + '..."' for m in SECRET_VAL.finditer(raw)]
if bad:
    print("aidd-route: FAIL - credential-shaped entries in %s:" % path, file=sys.stderr)
    for b in sorted(set(bad)):
        print("  %s" % b, file=sys.stderr)
    print("  provider credentials come from the environment only, never repo state", file=sys.stderr)
    raise SystemExit(1)
try:
    json.loads(raw)
except ValueError as exc:
    print("aidd-route: FAIL - %s is not valid JSON: %s" % (path, exc), file=sys.stderr)
    raise SystemExit(1)
print("aidd-route: config clean (no credentials, valid JSON)")
PY
    ;;
  *) die "unknown command '${cmd}'" ;;
esac
