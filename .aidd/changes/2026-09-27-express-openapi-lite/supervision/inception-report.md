# Supervision Report — inception — 2026-09-27-express-openapi-lite

<!-- Supervisor, at the phase boundary. Audits process compliance, not product quality. Re-audit #3, after the V6 re-runs, the REBUILD decision and the ADR-32..48 amendments. -->

## Checklist results

| Rule (from playbook checklist) | Evidence examined | Result |
|---|---|---|
| Audit log: dispatches present and in order | audit.log rows 1-61 now carry real timestamps. The 429 failure and re-dispatch are logged (row 42). The breach is logged (rows 41, 48) and so is REBUILD (row 49) | PASS for completeness (V1 closed) |
| Cost ledger; soft threshold | coordinator: 2,256,850 / 5.6M tokens (40%), 80.4 / 105 min (77%). cost-governance.md:153-165: soft means "Report and continue", once per crossing | PASS if the soft crossing is reported in a progress line. That line is not in state history yet (concern) |
| G1 approved with hashes | state `g1_prd.status: awaiting`. The PRD changed again (AC-004 zod ^4.2.0, AC-047, 47 ACs) | FAIL: V3 open |
| Impact + pre-review on the plan G2 approves | Re-runs returned at 12:34:31Z (rows 43-47). ADR-32..48, the PRD/epic amendments and all 8 story refreshes landed afterwards, at 12:51:16Z (rows 50-60). Grep for ADR-3[2-9] and ADR-4[0-8] finds 0 matches in impact-report.md and pre-review/* | FAIL: V6 recurs |
| Story lint, AC coverage, disjointness | row 61: lint VALID x8, 47/47 ACs, ownership pairwise disjoint, AC-044 split by design | PASS (orchestrator mechanical check) |
| Counter-arguments / synthesis | ADR-17/18/19 trace accepted previously. Known gap: architecture.md "S-07 depends on S-02 and S-06" has no SUPERSEDED marker (the epic says S-02, S-03, S-05, S-06) | CONCERN (minor) |
| No construction before G2 | row 41: "construction, orchestrator, ST-001..ST-008, built inline (no subagents); gates G1/G2 not approved". Row 48 records that PR #1 was merged. State history 10:35 "[construction 4/4] 8 stories built" | VIOLATION V7 (remediated by REBUILD, recorded) |

## Verdict (re-audit #2)

VIOLATIONS

## Violations from re-audit #2 (if any)

| # | Rule breached | Evidence of breach | Required remediation |
|---|---|---|---|
| V3 | Gates: G1 binds the current prd.md and requirements.json | g1_prd `awaiting`; the PRD was amended again (47 ACs) | The human re-approves G1 with fresh sha256 values for prd.md, requirements.json and intent.md. Record it as a distinct G1 ledger entry before or with the G2 digest. It must never be implied by G2 approval |
| V6 (recurred) | Steps 10-11 must cover the plan G2 approves | Re-runs at 12:34 predate the ADR-32..48 and story refreshes at 12:51. 0 ADR-32..48 references in impact-report.md or pre-review/* | Re-dispatch the Impact Analyst and all 4 pre-review dimensions (critical rigor) against the current architecture.md, epic and ST-001..ST-008. Resolve any CRITICALs. Log the dispatches and ledger rows, then re-audit. Freeze the plan until then |
| V7 (closed by REBUILD) | No construction before G2; roles not self-performed | audit.log row 41 attributes the inline build (no subagents) to the orchestrator. The coordinator's summary says "another session"; the two accounts must be reconciled | No re-run: the REBUILD from 4cea289 and the superseded construction-report remediate it. Correct the attribution in the log if row 41 is wrong. Before delivery, the human must decide how the rebuild PR treats PR #1's code already merged to main (revert or supersede) |

Minor: add the SUPERSEDED marker to the architecture.md S-07 dependency line. Report the cost soft crossing (77% minutes) in a progress line.
Closed: V1, V2, V4, V5. Snapshot (e): compliant.

---

## Re-audit #3 — targeted-fix round (this audit)

Scope note: the human explicitly chose "one final targeted fix" over another full pre-review round for the 4 findings from re-run #2 (PF-12/CR-16, N-5/T2, T1/N-6, PF-13). This audit therefore does NOT require impact-report.md / pre-review/* to reference ADR-49..53 — that would only apply if a further full review round had been ordered. What it does require: (a) V3 and the prior V6 recurrence are actually closed, (b) the 4 targeted fixes landed completely and coherently in architecture.md and every story ADR-49..53 assigns work to, (c) no new logical gaps were introduced that mechanical checks (schema lint, AC coverage, ownership-overlap) cannot see, (d) the two orchestrator "mechanical fixes" and the two rate-limited-but-verified dispatches are what they claim to be.

### Evidence examined

- `state.yaml` — `gates.g1_prd.status: approved`, `approved_by: human`, `at: 2026-09-27T12:59:42Z`, sha256 for prd.md/requirements.json/intent.md present → **V3 confirmed closed.**
- `audit.log` rows 62-87 — human G1 re-approval (row 77) precedes the ADR-49..53 targeted-fix dispatches (rows 78-84), which precede the mechanical fixes (rows 85-86) and the final story check (row 87). Order is correct.
- `architecture.md` — ADR-49 (error brand via `Symbol.for` brand key + `Symbol.hasInstance`, supersedes ADR-42), ADR-50 (per-story scoped mutation at merge, full run nightly-only, supersedes ADR-35's CI job shape), ADR-51 (`typecheck:v4`/`test:v4` mechanism, supersedes ADR-36's v4 mechanism; the `vitest.typecheck.v4.config.ts` ownership gap), ADR-52 (README zod>=4.2 wording, supersedes ADR-47's `<4.2` sentence), ADR-53 (SchemaAdapter member names, `parse`=`validate`/`toJsonSchema`=`toJSONSchema`) all present and each carries a clear SUPERSEDED linkage to the ADR it replaces (line 362, ADR-49/50/51 excerpts confirmed by direct read).
- Story grep for ADR-49..53 confirms all 8 stories carry the relevant subset: ST-001 (ADR-49 brand constants, ADR-50 CI jobs, ADR-51 typecheck:v4 mechanism + ownership-gap note), ST-002 (ADR-49 brand, ADR-50 scoped mutation), ST-003 (ADR-49 brand, ADR-52 zod subpath floor wording, ADR-53 member names, ADR-50 scoped mutation), ST-004/005/006 (ADR-50 scoped mutation commands, each with correct per-story `--mutate` globs), ST-007 (ADR-49 brand + minified/dual-load tests, ADR-50 scoped mutation), ST-008 (all five: ADR-49 brand README language, ADR-50 command docs, ADR-52 README zod wording supersedes ADR-47's stale sentence, ADR-53 README member names). PF-13 (stale `<4.2` README advice) is closed only in ST-008 and ST-003 — correct, since README ownership sits with S-08 and the adapter-facing wording with S-03.
- PF-12/CR-16 (brand under minification): ST-007's `test/entries/minified.test.ts` (line 176-182) explicitly red-first asserts cross-bundle `instanceof` under `esbuild --minify --keep-names=false`, and states the expected red reason under the old `this.name` approach — good coverage; test-strategy artifact is coherent with ADR-49's actual mechanism (brand symbol, not name string).
- N-5/T2 (mutation cost): ADR-50's per-story-scoped-at-merge / nightly-full-only split is applied uniformly — verified in ST-001 through ST-008 mutation sections; no story still asserts the old "full `npm run mutation` on every PR" shape except ST-003's explicitly-marked historical excerpt (superseded inline, not live guidance).
- T1/N-6 (v4 typecheck): ADR-51's `typecheck:v4`/`test:v4` split is implemented only in ST-001 (owner of the config files) and referenced (not re-implemented) elsewhere — correct single-ownership.
- **Gap found:** `epic.md`'s canonical shared-file ownership table (lines 128-134, "Each shared file has exactly one owner") still does **not** list `vitest.typecheck.v4.config.ts` under S-01, even though audit.log row 85 claims "vitest.typecheck.v4.config.ts added to S-01 row and file_scope (mechanical fix, no dispatch)" and ST-001's own `file_scope.owns` (line 24) does list it. The **story table** row for S-01 (epic.md line 11) also does not mention the file. This is exactly the class of gap the orchestrator's mechanical checks (schema lint, AC coverage, pairwise ownership-overlap across story files) cannot catch, because no other story claims the file — disjointness holds trivially — but the epic's own cross-reference table, which is supposed to be the single source of truth other stories check against, is now inconsistent with ST-001. Re-check with `grep -n "vitest.typecheck.v4.config.ts" epic.md` → only 1 hit (the general text at line 24 context is in ST-001, not epic.md); epic.md's ownership table hit count is 0.
- Two 429-affected dispatches (ST-002, ST-008): both stories carry complete ADR-49/50/52/53 content through to their file's natural end (no truncation observed at EOF), and both pass the row-87 lint. Spot-check consistent with "content complete despite failed status" claim.
- S-07 SUPERSEDED marker (minor from prior audit): confirmed fixed at architecture.md line 59: `S-07 depends on S-02 and S-06. **[SUPERSEDED per epic.md → S-02, S-03, S-05, S-06]**`.
- Cost soft-crossing progress line (minor from prior audit): now present, state.yaml history 12:52:47Z entry and 12:59:42Z entry both report cost/budget status in the progress line format. Closed.

### New finding

| # | Rule breached | Evidence of breach | Required remediation |
|---|---|---|---|
| V8 (new, minor) | Cross-artifact consistency: epic.md is the canonical shared-file ownership register; a story's `file_scope.owns` must match it exactly (this is what the pairwise-disjointness check silently assumes but does not itself verify against epic.md) | epic.md lines 128-134 omit `vitest.typecheck.v4.config.ts` under S-01, despite audit.log row 85 claiming it was added there; ST-001 line 24 does carry it | Orchestrator adds `vitest.typecheck.v4.config.ts` to epic.md's S-01 row (line 130) and, for completeness, to the S-01 story-table AC/file note if referenced elsewhere. Mechanical, no re-dispatch needed. Re-run the ownership check afterward and confirm the audit.log entry now matches reality |

## Verdict (re-audit #3)

VIOLATIONS (one new, minor, mechanically fixable; V3, V6, V7 from earlier rounds remain closed as of this audit)

- V3: CLOSED (G1 approved, hashes on file)
- V6: CLOSED for the scope actually ordered (targeted fix, not full re-review); no fabricated full-review claim was found
- V7: CLOSED (REBUILD)
- V8 (NEW): OPEN — epic.md ownership table missing `vitest.typecheck.v4.config.ts` under S-01, contradicting audit.log row 85's claim. Mechanical one-line fix; does not require re-dispatch or gate freeze, but must land and be re-verified before G2.
- No other new findings from spot-checking ADR-49..53 landing in architecture.md and stories; PF-12/CR-16, N-5/T2, T1/N-6, PF-13 all verified substantively fixed, not just referenced.
