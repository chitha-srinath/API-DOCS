#!/usr/bin/env bash
# Regenerate the AIDD dashboard from state files.
# Usage: render-dashboard.sh [global-state.yaml] [change-state.yaml|-] [out.html]
# Defaults: .aidd/state.yaml, the active change's state, .aidd/dashboard.html
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
GLOBAL="${1:-.aidd/state.yaml}"
CHANGE="${2:--}"
OUT="${3:-.aidd/dashboard.html}"
python3 - "${HERE}" "${GLOBAL}" "${CHANGE}" "${OUT}" <<'PY'
import json, os, re, sys

here, global_path, change_path, out = sys.argv[1:5]
ns = {'__name__': 'aidd_validate'}
with open(os.path.join(here, 'aidd-validate.py'), encoding='utf-8') as fh:
    exec(fh.read(), ns)
parse = ns['parse_yaml']

def load(path):
    if not path or path == '-' or not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as fh:
        return parse(fh.read()) or {}

g = load(global_path)
if change_path == '-':
    active = g.get('active_change')
    change_path = os.path.join(os.path.dirname(global_path) or '.', 'changes', str(active), 'state.yaml') if active else ''
c = load(change_path)

# Recent progress: the last N history events, newest first. Events written per
# protocol/progress.md carry the progress line verbatim; anything else renders dimmed.
PROGRESS_RE = re.compile(r'^\[[a-z]+ \d+/\d+\]')
PROGRESS_LIMIT = 12

def progress(change):
    rows = []
    for entry in change.get('history') or []:
        if not isinstance(entry, dict):
            continue
        line = str(entry.get('event') or '')
        contract = bool(PROGRESS_RE.match(line))
        state = 'blocked' if contract and re.search(r'\] (BLOCKED|FAILED):', line) else 'ok'
        rows.append({'at': entry.get('at') or '—', 'line': line,
                     'shape': 'contract' if contract else 'plain', 'state': state})
    return rows[-PROGRESS_LIMIT:][::-1]

template = os.path.join(here, '..', 'templates', 'dashboard.html')
with open(template, encoding='utf-8') as fh:
    html = fh.read()
html = html.replace('__AIDD_STATE_JSON__',
                    json.dumps({'global': g, 'change': c, 'progress': progress(c)}))
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
with open(out, 'w', encoding='utf-8') as fh:
    fh.write(html)
print(f'dashboard -> {out}')
PY
