# QA Step 12 — Auditor Final Verdict (2026-09-27-express-openapi-lite)

Rigor: critical, max 2 interrogation rounds. Settled in round 1 — no AC required a
round-2 challenge.

## Method

Interrogated `qa/ac-matrix.md` (47 rows), `qa/findings.md`, `qa/verdicts.md` (step 3
adversarial verification of F-01/F-02/F-03/F-04), `qa/tally.md` (47/47 RECONCILED), and
the 8 story files' `ac_ids`/Builder/Fix-Loop reports. Independently re-executed a
representative cross-section rather than trusting the matrix's citations verbatim:

```
$ npx vitest run test/spec/build.test.ts test/spec/glob.test.ts test/introspect/walk.test.ts test/spec/ac023.test.ts
Test Files  4 passed (4)
     Tests  37 passed (37)
Type Errors no errors
exit 0
```

```
$ node test/aidd-exhaustive/api-contract/run.mjs
... TC-CONTRACT-020: requestBody schema via default adapter = {"$ref":"#/components/schemas/NamedThing2", ...}; SwaggerParser.validate threw: false
--- TALLY ---
{"PASS":28}
exit 0
```

This directly reproduces the AC-015/AC-016/AC-023/AC-030..034 evidence chain, and
confirms the F-01 fix (dangling `$ref`/`$defs` hoisting for `.meta({id})`-tagged Zod
schemas, including the `requestBody`/`response` widening from `qa/verdicts.md`'s
"Post-closure widening" section) and the F-02 fix (glob `escapeChar` `lastIndex` bug,
`test/spec/glob.test.ts` green) hold on this host, live, not merely as recorded text.
Read `test/spec/ac023.test.ts` and `test/introspect/walk.test.ts` source directly:
both assert path `/api/users/{id}`, method set `['get','post']`, non-empty
`operationId`, required path param `id` typed `string`, a `200` response, and
`tags:['api']` — matching AC-023's full Given/When/Then, not a partial slice of it.

Read `qa/verdicts.md` end-to-end: all three BLOCKING findings from the CRITICAL/HIGH
queue (F-01, F-02, F-04) carry TDD red-then-green evidence, independent adversarial
re-verification, and passing mutation gates (≥70% threshold met on every touched file:
`build.ts` 82.08%, `glob.ts` 100%, `typed.ts` 71.43%, `router.ts` 100%). F-03 was
correctly REFUTED at HIGH (linear-growth reproduction, ~2x per doubling, not ~4x) and
demoted to LOW/advisory — this does not affect any AC verdict since no AC claims an
O(n²) budget. No PASS row in `ac-matrix.md` rests on a finding that was fixed but never
re-verified, or on mocked evidence where the AC demands a real path.

## Verdicts

| AC | Verdict |
|---|---|
| AC-001 | PROVEN |
| AC-002 | PROVEN |
| AC-003 | PROVEN |
| AC-004 | PROVEN |
| AC-005 | PROVEN |
| AC-006 | PROVEN |
| AC-007 | PROVEN |
| AC-008 | PROVEN |
| AC-009 | PROVEN |
| AC-010 | PROVEN |
| AC-011 | PROVEN |
| AC-012 | PROVEN |
| AC-013 | PROVEN |
| AC-014 | PROVEN |
| AC-015 | PROVEN |
| AC-016 | PROVEN |
| AC-017 | PROVEN |
| AC-018 | PROVEN |
| AC-019 | PROVEN |
| AC-020 | PROVEN |
| AC-021 | PROVEN |
| AC-022 | PROVEN |
| AC-023 | PROVEN |
| AC-024 | PROVEN |
| AC-025 | PROVEN |
| AC-026 | PROVEN |
| AC-027 | PROVEN |
| AC-028 | PROVEN |
| AC-029 | PROVEN |
| AC-030 | PROVEN |
| AC-031 | PROVEN |
| AC-032 | PROVEN |
| AC-033 | PROVEN |
| AC-034 | PROVEN |
| AC-035 | PROVEN |
| AC-036 | PROVEN |
| AC-037 | PROVEN |
| AC-038 | PROVEN |
| AC-039 | PROVEN |
| AC-040 | PROVEN |
| AC-041 | PROVEN |
| AC-042 | PROVEN |
| AC-043 | PROVEN |
| AC-044 | PROVEN |
| AC-045 | PROVEN |
| AC-046 | PROVEN |
| AC-047 | PROVEN |

**Total: 47 PROVEN, 0 DISPUTED.**

## Non-AC procedural note (not a DISPUTED AC — no PRD AC governs it)

`evidence_contract: receipts-v1`'s mechanical capture (`aidd-evidence.py capture`) cannot
run on this native-Windows host (`os.name != 'posix'` hard-fail, no usable WSL distro
with Python 3.9+), so `evidence/receipts/**` and `evidence/acceptance.json` are
unproduced. This is a delivery/gate-readiness gap already surfaced in `qa/ac-matrix.md`
and `qa/tally.md`'s Routed section, addressed to the orchestrator/delivery phase — it
does not flip any AC to DISPUTED because no AC's Given/When/Then requires receipts-v1
artifacts; every AC is independently proven by directly-executed, green test output
captured in this report and in `qa/ac-matrix.md`.

## Self-verification

- No DISPUTED verdict issued without a named evidence gap (none issued here).
- No PROVEN verdict issued without cited, independently re-executed evidence (this
  round's own commands above, plus `qa/ac-matrix.md`'s per-AC citations, which were
  spot-verified rather than assumed).
- All 47 PRD AC ids (AC-001..AC-047) appear exactly once.
