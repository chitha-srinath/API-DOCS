# Execution receipts

New change state declares `evidence_contract: receipts-v1`. Older changes without the field
remain readable and delivery emits a legacy warning. Never remove the field to bypass a
blocker. This protocol adds mechanical evidence checks, not another review agent.

## Approved requirements and receipt mapping

At Inception step 2, Product Analyst writes `requirements.json` from the requirements template,
mirroring the PRD's complete AC set, ids and text. G1 binds both. At QA step 9, AC Assessor
writes `evidence/acceptance.json` from the acceptance template. Every approved criterion
appears exactly once, with unchanged description and at least one successful receipt.
The manifest also lists at least one successful final suite receipt. Multiple criteria may
share a receipt only when the test actually verifies each criterion; reviewers check this.
Missing criteria, empty receipt lists, duplicates and changed descriptions block.

## Capture

From the project root, run the explicit verification command as argv:

```bash
python3 .aidd/framework/scripts/aidd-evidence.py capture \
  --host --out .aidd/changes/<change-id>/evidence/receipts/suite \
  --timeout 300 -- python3 -m unittest discover -s tests
```

`--host` is an explicit execution acknowledgment, not sandboxing. To retain the existing
sandbox protocol, pass the sandbox wrapper as the command, configuring its runtime/image
per `core/protocol/execution-environment.md`. The receipt records the wrapper argv; it does
not attest container isolation. Commands are never inferred from evidence or invoked through
an implicit shell. A caller choosing `bash -c` is explicitly choosing a shell.

Capture requires Linux, macOS or WSL, Python 3.9+ and Git. It runs at the repository root,
creates a new output directory under root `.aidd/`, and refuses to overwrite previous runs.
It records argv, UTC timestamps, elapsed time, exit status, Python/Git/platform versions,
source fingerprints before and after execution, and the combined output's hash and length.
The default limits are 300 seconds and 1 MiB of output. Timeout, interruption, output overflow,
launch failure or source mutation cannot produce passing evidence. Process groups are killed
on timeout/interruption and descendants are cleaned up when execution completes.

Keep secrets out of argv and output. Receipts and raw logs are local artifacts, not redacted
or automatically uploaded. Increase the output limit deliberately when a useful suite exceeds
it; truncated output never qualifies as proof. Capture suite and AC proofs only after final
source edits, or rerun them afterward. A formatter that changes source needs a later clean run.

## Verification and source scope

`aidd-evidence.py check` and `manifest` never execute commands. They recompute source and
log hashes, validate receipt status, and reject stale evidence. `aidd-ready.py` invokes the
same checks before delivery, and G3 binds the manifest plus all receipt files.

The fingerprint covers working bytes, paths and executable bits of Git-tracked and unignored
files, including dirty, untracked and deleted source. Root `.aidd/` is excluded to avoid
self-reference. Ignored dependencies/build products, environment variables, external services
and databases are outside this proof scope. Lockfiles should be tracked; pin runtime images
and separately verify external state. External/non-file symlinks and submodules block capture
rather than silently reducing scope. Fingerprints are endpoint observations, not continuous
filesystem monitoring; a change made and reverted during execution may not be detected.

## Trust boundary

Receipts are local records, not signed attestations. Someone who controls source, commands,
receipts and checker can forge them. The manifest cannot determine whether `true`, a mock,
or an incorrect assertion actually verifies an AC. Existing semantic reviewers, determinism
checks and human approval remain required. For stronger enforcement use a trusted CI runner
and a separately pinned checker; do not describe local receipt validity as compliance
certification or independent proof of execution.
