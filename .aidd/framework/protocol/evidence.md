# Evidence Protocol

Evidence over assertion: no agent may claim success without the command it ran, the exit
code, and a trimmed output excerpt.

## Evidence block format

```text
$ <command>
<trimmed output — first/last relevant lines>
[exit <code>] <ISO-8601 timestamp>
```

Reports missing evidence blocks are rejected once with "evidence missing"; a second miss
marks the step FAILED.

## Pre/post capture (Evidence Capturer)

- **Pre** (Construction step 0): baseline captures of every flow the PRD says will change —
  Playwright screenshots/traces for web UI, CLI/API transcripts otherwise — plus benchmark
  runs of the Bench Commands from `architecture.md`. Written to `evidence/pre/`.
- **Post** (QA, after fix loop + E2E): identical flows and benches → `evidence/post/`.
- **Manifest** (`evidence/manifest.md`): one row per capture — flow id, kind
  (screenshot|trace|transcript|bench), pre path, post path, sha256, note.
- **Degradation is explicit.** A non-UI target records `kind: transcript`; an inapplicable
  bench records `na` with a reason. Nothing is silently skipped.
- **Perf budget.** `architecture.md` sets thresholds (e.g. p95 latency, run duration). A
  post bench regressing beyond threshold fails `perf_within_budget` and feeds the fix loop.

## Execution receipts

New changes use `evidence_contract: receipts-v1`. The machine-readable companion to evidence
blocks is defined in `execution-receipts.md`. It binds final suite and per-AC results to
source fingerprints and output hashes. Prose reports remain necessary to explain what a
command proves; a receipt alone does not establish semantic correctness.
