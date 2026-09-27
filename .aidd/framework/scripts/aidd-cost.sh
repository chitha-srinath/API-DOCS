#!/usr/bin/env bash
# aidd-cost: summarize an AIDD change's cost ledger — spend, per-class medians, the
# deterministic projection, and threshold status (protocol/cost-governance.md).
# Zero hard dependencies (ADR 002): bash + python3 stdlib.
# READ-ONLY BY CONTRACT: it computes, it never edits state.yaml and never edits the ledger.
set -uo pipefail

usage() {
  cat <<'EOF'
Usage: aidd-cost.sh [options]

Summarizes a change's cost ledger: spend, per-dispatch-class medians, the projection, and
threshold status. Computes only — never writes state or the ledger.

Options:
  --ledger <path>     cost/ledger.md to read (default: the active change's ledger)
  --json <dir>        directory of per-dispatch usage JSON files, merged with the ledger
                      (each file: {at, phase, class, role, unit, tokens_in, tokens_out,
                      minutes}; `class` is the dispatch-class id from the protocol/dispatch.md
                      decision table, and a missing or null token field records
                      "not measured")
  --state <path>      change state.yaml to read cost.budget_tokens / cost.budget_minutes from
  --budget-tokens <n> override the token ceiling
  --budget-minutes <n> override the wall-clock ceiling
  --help              this text

Exit codes: 0 summary printed · 1 no ledger and no usage JSON found · 2 usage error.
EOF
}

LEDGER=""
JSON_DIR=""
STATE=""
BUDGET_TOKENS=""
BUDGET_MINUTES=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ledger)         LEDGER="${2:-}"; shift 2 || true ;;
    --json)           JSON_DIR="${2:-}"; shift 2 || true ;;
    --state)          STATE="${2:-}"; shift 2 || true ;;
    --budget-tokens)  BUDGET_TOKENS="${2:-}"; shift 2 || true ;;
    --budget-minutes) BUDGET_MINUTES="${2:-}"; shift 2 || true ;;
    --help|-h)        usage; exit 0 ;;
    *)                echo "aidd-cost: unknown option '$1'" >&2; usage >&2; exit 2 ;;
  esac
done

# Default discovery: the active change's ledger, then any single change ledger on disk.
if [ -z "${LEDGER}" ] && [ -z "${JSON_DIR}" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="."
  active=""
  if [ -f "${ROOT}/.aidd/state.yaml" ]; then
    active="$(grep -E '^active_change:' "${ROOT}/.aidd/state.yaml" 2>/dev/null \
      | head -1 | sed -e 's/^active_change:[[:space:]]*//' -e 's/^"//' -e 's/"$//')"
  fi
  if [ -n "${active}" ] && [ "${active}" != "null" ] \
     && [ -f "${ROOT}/.aidd/changes/${active}/cost/ledger.md" ]; then
    LEDGER="${ROOT}/.aidd/changes/${active}/cost/ledger.md"
    [ -z "${STATE}" ] && [ -f "${ROOT}/.aidd/changes/${active}/state.yaml" ] \
      && STATE="${ROOT}/.aidd/changes/${active}/state.yaml"
  fi
fi

if [ -n "${LEDGER}" ] && [ ! -f "${LEDGER}" ]; then
  echo "aidd-cost: no ledger at ${LEDGER}" >&2
  exit 1
fi
if [ -z "${LEDGER}" ] && [ -z "${JSON_DIR}" ]; then
  echo "aidd-cost: no ledger found (pass --ledger <path> or --json <dir>)" >&2
  exit 1
fi
if [ -n "${JSON_DIR}" ] && [ ! -d "${JSON_DIR}" ]; then
  echo "aidd-cost: no usage directory at ${JSON_DIR}" >&2
  exit 1
fi

python3 - "${LEDGER}" "${JSON_DIR}" "${STATE}" "${BUDGET_TOKENS}" "${BUDGET_MINUTES}" <<'PY'
import glob
import json
import os
import re
import sys

ledger_path, json_dir, state_path, arg_bt, arg_bm = sys.argv[1:6]

NOT_MEASURED = "not measured"


def num(text, default=None):
    """Parse an int/float cell; placeholders and 'not measured' return default."""
    s = (text or "").strip().replace(",", "").replace("_", "")
    if s in ("", NOT_MEASURED, "-", "na") or s.startswith("<"):
        return default
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        return default


def sections(text):
    """Split a markdown file into {heading: [lines]} for '## ' headings."""
    out, current = {}, None
    for line in text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip().lower()
            out[current] = []
        elif current is not None:
            out[current].append(line)
    return out


def table_rows(lines):
    """Pipe-table body rows as lists of trimmed cells (header + separator dropped)."""
    rows = []
    for line in lines:
        s = line.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c or "") for c in cells):
            continue
        rows.append(cells)
    return rows[1:] if rows else rows


dispatches, remaining, stops, budget = [], [], [], {}

if ledger_path and os.path.isfile(ledger_path):
    with open(ledger_path, encoding="utf-8") as fh:
        secs = sections(fh.read())
    for cells in table_rows(secs.get("budget", [])):
        if len(cells) >= 2:
            budget[cells[0]] = cells[1]
    for cells in table_rows(secs.get("dispatches", [])):
        if len(cells) < 11 or cells[0].startswith("<"):
            continue
        # Column 3 is the dispatch-class id (protocol/dispatch.md `Class`), which is what
        # every median groups on — Step text is neither unique nor atomic.
        dispatches.append({
            "at": cells[0], "phase": cells[1], "class": cells[2], "role": cells[3],
            "unit": cells[4], "tokens_in": num(cells[5]), "tokens_out": num(cells[6]),
            "minutes": num(cells[7], 0), "source": cells[10].lower(),
        })
    for cells in table_rows(secs.get("remaining planned dispatches", [])):
        if len(cells) >= 2 and not cells[0].startswith("<"):
            remaining.append((cells[0], num(cells[1], 0)))
    for cells in table_rows(secs.get("stops", [])):
        if len(cells) >= 5 and not cells[0].startswith("<"):
            stops.append(cells)

if json_dir:
    for path in sorted(glob.glob(os.path.join(json_dir, "*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                rec = json.load(fh)
        except (OSError, ValueError) as exc:
            print(f"warning: skipping {path}: {exc}", file=sys.stderr)
            continue
        ti, to = rec.get("tokens_in"), rec.get("tokens_out")
        dispatches.append({
            "at": str(rec.get("at", "")), "phase": str(rec.get("phase", "")),
            "class": str(rec.get("class") or rec.get("step") or ""),
            "role": str(rec.get("role", "")),
            "unit": str(rec.get("unit", "")), "tokens_in": ti, "tokens_out": to,
            "minutes": rec.get("minutes") or 0,
            "source": "measured" if (ti is not None and to is not None) else NOT_MEASURED,
        })

if not dispatches:
    print("cost: no dispatch rows recorded yet (0 rows)")
    print("status: within (nothing spent)")
    sys.exit(0)


def measured(row):
    return (row["source"] == "measured"
            and row["tokens_in"] is not None and row["tokens_out"] is not None)


def median(values):
    """Median with the protocol's stated tie rule: even count -> floored mean of the two
    middle values, so two runs over the same ledger project identically."""
    vals = sorted(values)
    n = len(vals)
    if n == 0:
        return None
    mid = n // 2
    if n % 2:
        return int(vals[mid])
    return int((vals[mid - 1] + vals[mid]) // 2)


meas = [r for r in dispatches if measured(r)]
unmeas = [r for r in dispatches if not measured(r)]
spent_tokens = sum(r["tokens_in"] + r["tokens_out"] for r in meas)
spent_minutes = sum(r["minutes"] or 0 for r in dispatches)

by_phase = {}
for r in dispatches:
    slot = by_phase.setdefault(r["phase"], {"tokens": 0, "minutes": 0.0, "rows": 0})
    if measured(r):
        slot["tokens"] += r["tokens_in"] + r["tokens_out"]
    slot["minutes"] += r["minutes"] or 0
    slot["rows"] += 1

class_tokens, class_minutes = {}, {}
for r in meas:
    class_tokens.setdefault(r["class"], []).append(r["tokens_in"] + r["tokens_out"])
for r in dispatches:
    class_minutes.setdefault(r["class"], []).append(r["minutes"] or 0)
medians = {c: median(v) for c, v in class_tokens.items()}

budget_tokens = num(arg_bt) or num(budget.get("budget_tokens", ""))
budget_minutes = num(arg_bm) or num(budget.get("budget_minutes", ""))
rigor = budget.get("rigor_mode", "")
if state_path and os.path.isfile(state_path):
    with open(state_path, encoding="utf-8") as fh:
        state_text = fh.read()
    if budget_tokens is None:
        m = re.search(r"^\s*budget_tokens:\s*(\d+)", state_text, re.M)
        budget_tokens = int(m.group(1)) if m else None
    if budget_minutes is None:
        m = re.search(r"^\s*budget_minutes:\s*(\d+)", state_text, re.M)
        budget_minutes = int(m.group(1)) if m else None

# ── projection: spent + Σ count(class) × median(class); unknown classes -> lower bound
proj_tokens, proj_minutes, unknown = spent_tokens, spent_minutes, []
for cls, count in remaining:
    med = medians.get(cls)
    if med is None:
        unknown.append(cls)
    else:
        proj_tokens += count * med
    med_min = median(class_minutes.get(cls, []))
    if med_min is not None:
        proj_minutes += count * med_min

print(f"# cost summary — {ledger_path or json_dir}")
if rigor and not rigor.startswith("<"):
    print(f"rigor mode: {rigor}")
print(f"rows: {len(dispatches)} (measured {len(meas)}, not measured {len(unmeas)})")
print(f"spent: {spent_tokens} tokens / {spent_minutes:g} min")
print(f"budget: {budget_tokens if budget_tokens is not None else NOT_MEASURED} tokens / "
      f"{budget_minutes if budget_minutes is not None else NOT_MEASURED} min")

print("")
print("## by phase")
for phase in sorted(by_phase):
    slot = by_phase[phase]
    print(f"{phase}: {slot['tokens']} tokens / {slot['minutes']:g} min "
          f"({slot['rows']} rows)")

print("")
print("## class medians (measured rows only)")
if medians:
    for cls in sorted(medians):
        print(f"{cls}: median {medians[cls]} tokens over {len(class_tokens[cls])} rows")
else:
    print(f"{NOT_MEASURED} — no measured row carries a dispatch class yet")

print("")
print("## projection")
if unknown:
    plural = "es" if len(unknown) != 1 else ""
    print(f"projection: >= {proj_tokens} tokens — LOWER BOUND ({len(unknown)} unknown "
          f"class{plural}: {', '.join(sorted(unknown))})")
else:
    print(f"projection: {proj_tokens} tokens")
print(f"projection_minutes: {proj_minutes:g} min")
print(f"remaining planned dispatches: {sum(c for _, c in remaining)} "
      f"across {len(remaining)} classes")

# ── thresholds: soft 70% (or projection over budget), hard 100%, runaway 5x class median
# Every tripped condition is noted; the reported status is the most severe one.
RANK = {"within": 0, "soft": 1, "hard": 2}
status, notes = "within", []


def trip(level, note):
    global status
    notes.append(note)
    if RANK[level] > RANK[status]:
        status = level


if budget_tokens:
    if spent_tokens >= budget_tokens:
        trip("hard", "spent_tokens at or over budget_tokens")
    elif spent_tokens >= 0.70 * budget_tokens:
        trip("soft", "spent_tokens at or over 70% of budget_tokens")
    if proj_tokens >= budget_tokens:
        trip("soft", "projection at or over budget_tokens")
if budget_minutes:
    if spent_minutes >= budget_minutes:
        trip("hard", "spent_minutes at or over budget_minutes")
    elif spent_minutes >= 0.70 * budget_minutes:
        trip("soft", "spent_minutes at or over 70% of budget_minutes")

runaways = []
for r in meas:
    total = r["tokens_in"] + r["tokens_out"]
    med = medians.get(r["class"])
    rows = len(class_tokens.get(r["class"], []))
    if med and rows >= 3 and total >= 5 * med:
        runaways.append(f"{r['class']}/{r['unit']}: {total} tokens >= 5x class median {med}")
    elif budget_tokens and rows < 3 and total >= 0.25 * budget_tokens:
        runaways.append(f"{r['class']}/{r['unit']}: {total} tokens >= 25% of budget "
                        f"(class has {rows} measured rows, no usable median)")

print("")
print("## thresholds")
print(f"status: {status}")
for note in notes:
    print(f"note: {note}")
if runaways:
    for line in runaways:
        print(f"runaway candidate: {line}")
else:
    print("runaway candidates: none")
if stops:
    print("")
    print("## stops")
    for cells in stops:
        print(" | ".join(cells))
    pending = [c for c in stops if c[-1].strip().lower() == "pending"]
    if pending:
        print(f"UNRESOLVED: {len(pending)} stop row(s) still pending — "
              "within_cost_budget fails until a disposition is recorded")
PY
