#!/usr/bin/env python3
"""Read-only environment diagnostics; never installs tools or runs project scripts."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def inspect(root, installed=False):
    checks = []
    def add(name, status, detail):
        checks.append({'name': name, 'status': status, 'detail': detail})
    add('python', 'ok' if sys.version_info >= (3, 9) else 'error',
        'Python 3.9+ required; running ' + '.'.join(map(str, sys.version_info[:3])))
    add('capture_platform', 'ok' if os.name == 'posix' else 'error',
        'POSIX process groups available' if os.name == 'posix' else 'Use Linux, macOS or WSL for receipt capture')
    if shutil.which('git'):
        result = subprocess.run(['git', '-C', str(root), 'rev-parse', '--show-toplevel'],
                                capture_output=True, text=True)
        add('repository', 'ok' if result.returncode == 0 else 'error',
            'Git repository detected' if result.returncode == 0 else 'Run from a Git repository')
    else:
        add('git', 'error', 'Install Git and rerun the doctor')
    framework = root / '.aidd/framework'
    if not framework.exists() and (root / 'core/scripts/aidd-ready.py').exists() and not installed:
        framework = root / 'core'
    for filename in ['aidd-ready.py', 'aidd-evidence.py', 'aidd-report.py', 'aidd-validate.py']:
        add(filename, 'ok' if (framework / 'scripts' / filename).is_file() else 'error',
            'Available' if (framework / 'scripts' / filename).is_file() else 'Install or upgrade AIDD from this release')
    runtime = next((name for name in ['podman', 'docker'] if shutil.which(name)), None)
    add('sandbox', 'warning', (runtime + ' executable found; daemon/image availability not tested') if runtime
        else 'No container runtime found; evidence capture executes on the host only with --host')
    stacks = [label for name, label in [('package.json', 'Node'), ('pyproject.toml', 'Python'),
              ('requirements.txt', 'Python'), ('go.mod', 'Go'), ('Cargo.toml', 'Rust'),
              ('pom.xml', 'Java/Maven'), ('build.gradle', 'Java/Gradle'), ('Gemfile', 'Ruby')]
              if (root / name).is_file()]
    add('project', 'ok', ', '.join(sorted(set(stacks))) if stacks else 'Generic repository; supply explicit verification commands')
    add('proof_scope', 'warning', 'Receipts cover Git-tracked and unignored files, excluding root .aidd; ignored dependencies and external services are outside scope')
    return {'ready': all(check['status'] != 'error' for check in checks), 'checks': checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path('.'))
    parser.add_argument('--installed', action='store_true', help='Require vendored installation')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    result = inspect(args.repo.resolve(), args.installed)
    if args.json:
        print(json.dumps(result, sort_keys=True))
    else:
        print('READY' if result['ready'] else 'SETUP REQUIRED')
        for row in result['checks']:
            print(f'{row["status"].upper():7} {row["name"]}: {row["detail"]}')
    return int(not result['ready'])


if __name__ == '__main__':
    sys.exit(main())
