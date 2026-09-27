#!/usr/bin/env python3
"""Source-bound execution receipts and acceptance evidence (Python 3.9+, POSIX)."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import selectors
import signal
import stat
import subprocess
import sys
import time

VERSION = 1
SCOPE = 'git-tracked-and-unignored-v1-excluding-root-aidd'
HEX = re.compile(r'^[0-9a-f]{64}$')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            value.update(chunk)
    return value.hexdigest()


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, check=True)
    return result.stdout


def repo_root(path):
    return Path(os.fsdecode(git(path, 'rev-parse', '--show-toplevel')).strip()).resolve()


def snapshot(root):
    """Hash working bytes, paths and executable modes, including untracked source.

    Ignored files and root .aidd artifacts are explicitly outside the proof scope.
    Submodules and external symlinks fail rather than claiming complete coverage.
    """
    root = root.resolve()
    names = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0')
    entries = []
    for raw in sorted(set(names) - {b''}):
        name = os.fsdecode(raw)
        if name == '.aidd' or name.startswith('.aidd/'):
            continue
        path = root / name
        try:
            mode = path.lstat().st_mode
        except FileNotFoundError:
            entries.append([name, 'deleted'])
            continue
        if stat.S_ISLNK(mode):
            target = path.resolve()
            if not target.is_relative_to(root) or not target.is_file():
                raise ValueError(f'Unsupported external or non-file symlink: {name}')
            entries.append([name, 'symlink', os.readlink(path), file_digest(target)])
        elif stat.S_ISREG(mode):
            entries.append([name, 'executable' if mode & 0o111 else 'file', file_digest(path)])
        else:
            raise ValueError(f'Unsupported source entry (submodule or special file): {name}')
    return {'scope': SCOPE, 'sha256': digest(json.dumps(entries, ensure_ascii=True,
            separators=(',', ':')).encode()), 'file_count': len(entries)}


def local(root, name):
    root = root.resolve()
    if not isinstance(name, str) or not name or Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('Expected a nonempty relative path without parent traversal')
    path = (root / name).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f'Missing or outside artifact: {name}')
    return path


def load_json(path):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError(f'Duplicate JSON key: {key}')
            obj[key] = value
        return obj
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique)


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def execute(argv, root, timeout, limit):
    """Bound elapsed time and captured bytes; kill the process group on interruption."""
    start = time.monotonic()
    output = bytearray()
    status = 'completed'
    process = subprocess.Popen(argv, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               start_new_session=True)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        while selector.get_map():
            if time.monotonic() - start >= timeout:
                status = 'timeout'
                break
            for key, _ in selector.select(min(0.1, max(0, timeout - (time.monotonic() - start)))):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                elif len(output) + len(chunk) > limit:
                    output.extend(chunk[:max(0, limit - len(output))])
                    status = 'output_limit'
                    break
                else:
                    output.extend(chunk)
            if status != 'completed':
                break
        if status == 'completed':
            try:
                process.wait(timeout=max(0.001, timeout - (time.monotonic() - start)))
            except subprocess.TimeoutExpired:
                status = 'timeout'
    except KeyboardInterrupt:
        status = 'interrupted'
    finally:
        # Also remove descendants left behind by a completed command.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        selector.close()
        process.stdout.close()
    return status, process.returncode, bytes(output), round(time.monotonic() - start, 6)


def capture(args):
    if os.name != 'posix':
        raise ValueError('Capture requires POSIX process groups (Linux, macOS or WSL)')
    if not args.host:
        raise ValueError('Execution requires --host; use an explicit sandbox wrapper in argv when needed')
    if not args.command or not math.isfinite(args.timeout) or args.timeout <= 0 or args.max_output_bytes < 1:
        raise ValueError('A command, positive finite timeout and positive output limit are required')
    root = repo_root(args.repo)
    out = args.out.resolve()
    # This prevents the receipt itself from invalidating its own source fingerprint.
    if not out.is_relative_to(root / '.aidd') or out == root / '.aidd':
        raise ValueError('Receipt output must be inside the repository root .aidd directory')
    before = snapshot(root)
    out.mkdir(parents=True, exist_ok=False)
    started = timestamp()
    status, code, output, elapsed = 'launch_error', None, b'', 0.0
    error = None
    try:
        status, code, output, elapsed = execute(args.command, root, args.timeout, args.max_output_bytes)
    except OSError as exc:
        error = str(exc)
    try:
        after = snapshot(root)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        after = None
        error = str(exc)
        status = 'snapshot_error'
    if out.resolve() != out:
        raise ValueError('Receipt directory changed during execution')
    with (out / 'output.log').open('xb') as stream:
        stream.write(output)
    receipt = {
        'schema': VERSION, 'argv': args.command, 'cwd': '.', 'execution': 'host',
        'started_at': started, 'finished_at': timestamp(), 'duration_seconds': elapsed,
        'status': status, 'exit_code': code, 'source_before': before, 'source_after': after,
        'output': {'path': 'output.log', 'sha256': digest(output), 'bytes': len(output)},
        'runtime': {'python': platform.python_version(), 'platform': platform.system(),
                    'git': git(root, '--version').decode().strip()},
        'limits': {'timeout_seconds': args.timeout, 'output_bytes': args.max_output_bytes},
        'error': error,
    }
    target = out / 'receipt.json'
    with target.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
    errors = verify(target, root)
    print(json.dumps({'ready': not errors, 'receipt': str(target), 'errors': errors}, sort_keys=True))
    return 130 if status == 'interrupted' else int(bool(errors))


def verify(path, root, current=None):
    errors = []
    try:
        receipt = load_json(path)
        if not isinstance(receipt, dict) or type(receipt.get('schema')) is not int or receipt['schema'] != VERSION:
            raise ValueError('Unsupported receipt schema')
        required = {'schema', 'argv', 'cwd', 'execution', 'started_at', 'finished_at',
                    'duration_seconds', 'status', 'exit_code', 'source_before', 'source_after',
                    'output', 'runtime', 'limits', 'error'}
        if set(receipt) != required:
            raise ValueError('Incomplete or unknown receipt fields')
        duration = receipt['duration_seconds']
        if type(duration) not in (int, float) or not math.isfinite(duration) or duration < 0:
            raise ValueError('Invalid elapsed time')
        runtime = receipt['runtime']
        if not isinstance(runtime, dict) or set(runtime) != {'python', 'platform', 'git'} or not all(
                isinstance(value, str) and value for value in runtime.values()):
            raise ValueError('Invalid runtime metadata')
        limits = receipt['limits']
        if not isinstance(limits, dict) or set(limits) != {'timeout_seconds', 'output_bytes'}:
            raise ValueError('Invalid execution limits')
        if type(limits['timeout_seconds']) not in (int, float) or not math.isfinite(limits['timeout_seconds']) or limits['timeout_seconds'] <= 0 or type(limits['output_bytes']) is not int or limits['output_bytes'] < 1:
            raise ValueError('Invalid execution limits')
        argv = receipt.get('argv')
        if not isinstance(argv, list) or not argv or not all(isinstance(a, str) and '\0' not in a for a in argv):
            raise ValueError('Invalid receipt argv')
        if receipt.get('cwd') != '.' or receipt.get('execution') != 'host':
            raise ValueError('Unsupported execution context')
        for field in ('started_at', 'finished_at'):
            datetime.strptime(receipt[field], '%Y-%m-%dT%H:%M:%SZ')
        if receipt['finished_at'] < receipt['started_at']:
            raise ValueError('Receipt finishes before it starts')
        if receipt.get('status') != 'completed' or type(receipt.get('exit_code')) is not int or receipt['exit_code'] != 0:
            errors.append('Command did not complete successfully')
        if receipt.get('error'):
            errors.append('Capture recorded an error')
        current = snapshot(root) if current is None else current
        for field in ('source_before', 'source_after'):
            source = receipt.get(field)
            if not isinstance(source, dict) or source.get('scope') != SCOPE or source != current:
                errors.append(f'{field}: source differs from current repository or proof scope')
        output = receipt['output']
        if not isinstance(output, dict) or not isinstance(output.get('sha256'), str) or not HEX.fullmatch(output['sha256']):
            raise ValueError('Invalid output digest')
        log = local(path.parent, output['path'])
        if file_digest(log) != output['sha256'] or type(output.get('bytes')) is not int or log.stat().st_size != output['bytes']:
            errors.append('Output log missing, truncated or modified')
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        errors.append(f'Invalid receipt: {exc}')
    return errors


def check_manifest(change, root):
    """Every explicit AC must cite at least one successful, current receipt."""
    errors, results = [], []
    try:
        manifest = load_json(change / 'evidence/acceptance.json')
        if not isinstance(manifest, dict) or set(manifest) != {'schema', 'requirements', 'suite_receipts'} or type(manifest['schema']) is not int or manifest['schema'] != VERSION:
            raise ValueError('Acceptance manifest requires schema=1, requirements and suite_receipts')
        requirements = manifest['requirements']
        if not isinstance(requirements, list) or not requirements:
            raise ValueError('At least one acceptance requirement is required')
        approved = load_json(change / 'requirements.json')
        if not isinstance(approved, dict) or set(approved) != {'schema', 'requirements'} or type(approved['schema']) is not int or approved['schema'] != VERSION:
            raise ValueError('Approved requirements require schema=1 and requirements')
        if not isinstance(approved['requirements'], list) or not approved['requirements']:
            raise ValueError('Approved requirement set is empty')
        expected = {}
        for item in approved['requirements']:
            if not isinstance(item, dict) or set(item) != {'id', 'description'}:
                raise ValueError('Approved requirements need id and description')
            if not isinstance(item['id'], str) or item['id'] in expected or not isinstance(item['description'], str):
                raise ValueError('Invalid or duplicate approved requirement')
            expected[item['id']] = item['description']
        current, cache = snapshot(root), {}
        def check_refs(refs):
            if not isinstance(refs, list) or not refs or not all(isinstance(r, str) for r in refs):
                return ['At least one receipt path is required']
            failures = []
            if len(set(refs)) != len(refs):
                failures.append('Duplicate receipt reference')
            for ref in refs:
                if ref not in cache:
                    try:
                        cache[ref] = verify(local(change, ref), root, current)
                    except (OSError, ValueError) as exc:
                        cache[ref] = [str(exc)]
                failures.extend(f'{ref}: {error}' for error in cache[ref])
            return failures
        errors.extend('suite: ' + e for e in check_refs(manifest['suite_receipts']))
        seen = set()
        for item in requirements:
            if not isinstance(item, dict) or set(item) != {'id', 'description', 'receipts'}:
                raise ValueError('Each requirement needs id, description and receipts')
            identifier = item['id']
            if not isinstance(identifier, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}', identifier) or identifier in seen:
                raise ValueError('Invalid or duplicate requirement id')
            seen.add(identifier)
            if not isinstance(item['description'], str) or not item['description'].strip():
                raise ValueError('Requirement description cannot be empty')
            failures = check_refs(item['receipts'])
            errors.extend(f'{identifier}: {error}' for error in failures)
            if expected.get(identifier) != item['description']:
                failures.append('Criterion is absent from approved requirements or its description changed')
                errors.append(f'{identifier}: approved criterion mismatch')
            results.append({'id': identifier, 'description': item['description'],
                            'ready': not failures, 'receipts': item['receipts']})
        for missing in sorted(set(expected) - seen):
            errors.append(f'{missing}: approved requirement omitted from evidence manifest')
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as exc:
        errors.append(f'Invalid acceptance evidence: {exc}')
    return {'ready': not errors, 'errors': errors, 'requirements': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    run = sub.add_parser('capture', help='Run explicit argv and save a new receipt directory')
    run.add_argument('--repo', type=Path, default=Path('.'))
    run.add_argument('--out', type=Path, required=True)
    run.add_argument('--host', action='store_true', help='Acknowledge execution on this host')
    run.add_argument('--timeout', type=float, default=300)
    run.add_argument('--max-output-bytes', type=int, default=1048576)
    run.add_argument('command', nargs=argparse.REMAINDER)
    check = sub.add_parser('check', help='Verify a receipt without executing anything')
    check.add_argument('receipt', type=Path)
    check.add_argument('--repo', type=Path, default=Path('.'))
    manifest = sub.add_parser('manifest', help='Verify acceptance coverage and suite evidence')
    manifest.add_argument('change', type=Path)
    manifest.add_argument('--repo', type=Path, default=Path('.'))
    args = parser.parse_args()
    try:
        if args.action == 'capture':
            if args.command[:1] == ['--']:
                args.command = args.command[1:]
            return capture(args)
        root = repo_root(args.repo)
        if args.action == 'check':
            errors = verify(args.receipt.resolve(), root)
            result = {'ready': not errors, 'errors': errors}
        else:
            result = check_manifest(args.change.resolve(), root)
        print(json.dumps(result, sort_keys=True))
        return int(not result['ready'])
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({'ready': False, 'errors': [str(exc)]}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
