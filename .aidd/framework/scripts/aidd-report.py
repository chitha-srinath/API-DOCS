#!/usr/bin/env python3
"""Export a local acceptance evidence report; no uploads, scripts or remote assets."""
import argparse
from html import escape
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

spec = importlib.util.spec_from_file_location('evidence', Path(__file__).with_name('aidd-evidence.py'))
evidence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evidence)


def render(report):
    state = 'CURRENT EVIDENCE' if report['ready'] else 'BLOCKED'
    rows = ''.join('<tr><td>' + escape(row['id']) + '</td><td>' + escape(row['description']) +
                   '</td><td>' + ('Current' if row['ready'] else 'Blocked') + '</td><td>' +
                   '<br>'.join(escape(ref) for ref in row['receipts']) + '</td></tr>'
                   for row in report['requirements'])
    errors = ''.join('<li>' + escape(error) + '</li>' for error in report['errors'])
    return '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>AIDD Delta — Evidence report</title><style>
body{font:16px/1.6 system-ui,sans-serif;background:#f4f7fb;color:#152337;margin:0;padding:36px}
main{max-width:1100px;margin:auto;background:white;padding:36px;border-radius:12px}
h1{font-size:32px;margin:8px 0} .tag{font-weight:700;color:#254d91;letter-spacing:.08em}
.table{overflow:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;
border-bottom:1px solid #dce3ed;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3fa}
.note{color:#46566c;font-size:14px}li{overflow-wrap:anywhere}@media print{body{padding:0}main{padding:0}}
</style><main><div class="tag">AIDD DELTA · EXECUTION EVIDENCE</div><h1>''' + state + '''</h1>
<p>Local verification snapshot. This report checks recorded execution and source freshness;
it does not certify correctness, security, compliance, or delivery readiness.</p>
<div class="table"><table><thead><tr><th>Criterion</th><th>Description</th><th>Evidence</th>
<th>Receipts</th></tr></thead><tbody>''' + rows + '''</tbody></table></div>
<h2>Blockers</h2>''' + ('<ul>' + errors + '</ul>' if errors else '<p>No receipt blockers detected.</p>') + '''
<p class="note">Command output and repository paths are not embedded. Review descriptions and
receipt names before sharing. No telemetry, external assets or executable scripts.
Evidence may become stale after export; rerun verification before a release.</p></main></html>\n'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('change', type=Path)
    parser.add_argument('--repo', type=Path, default=Path('.'))
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--format', choices=['html', 'json'], default='html')
    args = parser.parse_args()
    try:
        report = evidence.check_manifest(args.change.resolve(), evidence.repo_root(args.repo))
        content = render(report) if args.format == 'html' else json.dumps(report, indent=2) + '\n'
        with args.out.open('x', encoding='utf-8') as stream:
            stream.write(content)
        print(json.dumps({'ready': report['ready'], 'report': str(args.out.resolve())}))
        return int(not report['ready'])
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({'ready': False, 'errors': [str(exc)]}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
