# Test Cases — <category> — <change-id / target>

<!-- One Test Engineer per category. Exhaustive by design: possible AND impossible cases. -->

| TC id | ac_ids | Type | Preconditions | Input / request | Steps | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| TC-CAT-001 | | happy | | | | | | PASS | ev: … |

<!-- ac_ids: AC id(s) this case evidences (from the story frontmatter); `na` for cases with no
     AC mapping (e.g. performance-smoke) — na-mapped cases debate as advisory only.
     Type is one of happy|negative|boundary|impossible|abuse|contract|concurrency|idempotency|regression|perf.
     Result is one of PASS|FAIL|BLOCKED|NA. No PASS without an executed-evidence reference. -->

## Tally

- designed: · passed: · failed: · blocked: · na:

## Defects (each FAIL feeds the QA fix loop)

| TC id | Suspected severity | Minimal reproduction |
|---|---|---|
