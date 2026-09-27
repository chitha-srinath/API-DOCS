#!/usr/bin/env python3
"""Read-only delivery preflight. Exit 0 ready, 1 blocked, 2 invalid input.

Usage: python3 aidd-ready.py CHANGE_DIRECTORY [--json]
Never executes commands from artifacts or changes state.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import subprocess

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('state_validator', HERE / 'aidd-validate.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
evidence_spec = importlib.util.spec_from_file_location('evidence', HERE / 'aidd-evidence.py')
evidence = importlib.util.module_from_spec(evidence_spec)
evidence_spec.loader.exec_module(evidence)

FAST_NA = {
    'auditor_approved', 'debate_complete', 'tally_reconciled', 'security_clean',
    'e2e_verified', 'mutation_floor_met', 'evidence_captured', 'perf_within_budget',
    'evidence_reproduced',
}


def local_file(root, name):
    path = Path(name)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('artifact path must be relative without parent traversal')
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ValueError('artifact missing or outside change directory')
    return resolved


def check(root, state, schema):
    errors = []
    def block(code, message):
        errors.append({'code': code, 'message': message})

    mode = state.get('rigor', {}).get('mode', 'standard')
    if state['phase'] != 'delivery' or state['phase_status'] not in ('in_progress', 'complete'):
        block('phase', 'Delivery must be in_progress or complete.')
    if state.get('blocked_reason'):
        block('blocked', state['blocked_reason'])
    quality = state.get('quality_gates', {})
    for name in schema['properties']['quality_gates']['properties']:
        value = quality.get(name)
        status = value.get('status') if isinstance(value, dict) else value
        reason = value.get('reason', '') if isinstance(value, dict) else ''
        allowed_na = (mode == 'fast' and name in FAST_NA and reason == 'rigor:fast')
        allowed_na |= name == 'within_cost_budget' and reason == 'cost:no-dispatches'
        if status != 'passed' and not (status == 'na' and allowed_na):
            block('quality_gate', f'{name}: must pass or carry a permitted current-mode na reason.')

    groups = {
        'g1_prd': ['prd.md'],
        'g2_plan': ['architecture.md', 'counter-arguments.md', 'impact-report.md',
                    'epic.md', 'stories/**/*', 'pre-review/**/*'],
        'g3_premerge': ['qa/**/*', 'qa/critic-verdict.md', 'ac-matrix.md'],
        'g_test_report': ['qa/test-report.md'],
    }
    if state.get('evidence_contract') == 'receipts-v1':
        groups['g1_prd'].append('requirements.json')
        groups['g3_premerge'].extend(['evidence/acceptance.json', 'evidence/receipts/**/*'])
        try:
            report = evidence.check_manifest(root, evidence.repo_root(root))
            for error in report['errors']:
                block('execution_evidence', error)
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            block('execution_evidence', str(exc))
    if mode != 'fast':
        groups['g3_premerge'].append('evidence/post/**/*')
    for name, patterns in groups.items():
        gate = state.get('gates', {}).get(name, {})
        if gate.get('status') != 'approved':
            block('approval', f'{name}: approved disposition required.')
        human = state['mode'] == 'let-me-look' or (name == 'g3_premerge' and bool(state.get('rigor', {}).get('escalations')))
        if gate.get('approved_by') not in (('human',) if human else ('human', 'auto')):
            block('approver', f'{name}: {"human" if human else "human or auto"} approver required.')
        if not gate.get('at'):
            block('approval_time', f'{name}: approval timestamp required.')
        bindings = gate.get('artifacts', [])
        # Legacy single-file approvals remain readable, but cannot cover a multi-file gate.
        if not bindings and gate.get('artifact') and gate.get('artifact_sha256'):
            bindings = [{'path': gate['artifact'], 'sha256': gate['artifact_sha256']}]
        bound = set()
        for item in bindings:
            path, digest = item['path'], item['sha256']
            if path in bound:
                block('duplicate_artifact', f'{name}: duplicate binding {path}.')
            bound.add(path)
            try:
                artifact = local_file(root, path)
                actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
                if digest != actual:
                    block('stale_artifact', f'{name}: {path} hash does not match; re-approve.')
            except (OSError, ValueError) as exc:
                block('artifact', f'{name}: {path}: {exc}.')
        for pattern in patterns:
            paths = sorted(p.relative_to(root).as_posix() for p in root.glob(pattern) if p.is_file())
            if not paths:
                block('missing_artifact', f'{name}: no artifact matches {pattern}.')
            for path in paths:
                if path not in bound:
                    block('unbound_artifact', f'{name}: {path} has no approval hash.')
    for stop in state.get('cost', {}).get('stops', []):
        if stop['disposition'] in ('pending', 'aborted'):
            block('cost_stop', f'Unresolved cost stop: {stop["reason"]}.')
    for name, status in state.get('supervision', {}).items():
        if status != 'compliant':
            block('supervision', f'{name}: {status}.')
    for name, story in state.get('stories', {}).items():
        if story['status'] not in ('built', 'done'):
            block('story', f'{name}: {story["status"]}.')
    for ruling in state.get('audit', {}).get('negotiation', {}).get('rulings', []):
        if ruling['ruling'] == 'UNRESOLVABLE':
            block('ruling', f'{ruling["ac_id"]}: unresolved adjudication.')
    if mode != 'fast':
        det = state.get('determinism', {})
        if det.get('repeats_required', 0) < 2 or det.get('repeats_done', 0) < det.get('repeats_required', 2):
            block('determinism', 'Required repeat runs have not completed.')
        try:
            local_file(root, det.get('report') or '')
        except (OSError, ValueError):
            block('determinism_report', 'A local determinism report is required.')
        for item in det.get('quarantined', []):
            if item['disposition'] == 'pending' or (item['disposition'] == 'accepted' and not (item.get('accepted_reason') or '').strip()):
                block('quarantine', f'{item["test"]}: unresolved quarantine or missing acceptance reason.')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('change_directory', type=Path)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    warnings = []
    try:
        root = args.change_directory.resolve()
        schema = json.loads((HERE.parent / 'schemas/change-state.schema.json').read_text())
        state = validator.parse_yaml((root / 'state.yaml').read_text())
        invalid = []
        validator.validate(state, schema, '$', invalid)
        if invalid:
            errors = [{'code': 'schema', 'message': message} for message in invalid]
            code = 2
        else:
            if state.get('evidence_contract') != 'receipts-v1':
                warnings.append('Legacy change: execution receipts are not required; source freshness is not checked.')
            errors = check(root, state, schema)
            code = int(bool(errors))
    except (OSError, ValueError, validator.ParseError) as exc:
        errors = [{'code': 'input', 'message': str(exc)}]
        code = 2
    result = {'ready': code == 0, 'errors': errors, 'warnings': warnings}
    if args.json:
        print(json.dumps(result, sort_keys=True))
    else:
        print('READY' if code == 0 else 'BLOCKED')
        for warning in warnings:
            print(f'  WARNING: {warning}')
        for error in errors:
            print(f'  {error["code"]}: {error["message"]}')
    return code


if __name__ == '__main__':
    sys.exit(main())
