# Monitoring note — Construction Wave 1 (ST-001 scaffold)

Role: master-agent, mode: monitor
Scope: Builder Report appended to `stories/ST-001-scaffold.md`, cross-checked against the
actual repo files it claims to have created.

## Method

Read the story (requirements + test plan + verification commands) and the Builder Report's
Green evidence, AC self-check and diff-stat sections. Then read the cited source artifacts
directly — not just the report's description of them — and compared them line-by-line
against the story's required shape: `src/core/types.ts`, `package.json`, `tsup.config.ts`,
`.github/workflows/{ci,release,mutation-full}.yml`, `test/fixtures/{majors,fresh-express}.ts`,
`.gitignore`.

## Findings

**Claims that check out against the actual source (not just the report's narrative):**

- `src/core/types.ts` matches ADR-27c's `RegistryEntry`/`RouteRegistry` verbatim, and exports
  exactly the six ADR-43/ADR-49 symbols as `unique symbol` with the correct `v1.*` keys
  (`express-api-contract.v1.meta/.mount/.child/.recorder/.brand/.brandKey`). This is checkable
  independently of the report's prose — the file itself is the evidence, and it is correct.
- `package.json` matches the story's "Required shape" almost exactly: `name`, `license`,
  `type`, `main`, `types`, no `module` field, `exports` for `.`/`./manual`/`./zod`/
  `./package.json` each with import/require/types/default, `sideEffects` array exactly as
  ADR-24 requires, peers and peerDependenciesMeta exactly as ADR-21/29/47 require, `engines`,
  and the nine scripts named in the story (`build`, `test`, `test:v4`, `typecheck:v4`, `lint`,
  `check:pack`, `mutation`, `perf`, `audit`). No `dependencies` field, no single-value/docs-ui
  keys anywhere — AC-004/AC-020 claims hold up on direct inspection.
- `tsup.config.ts` implements ADR-40 precisely: `splitting: false`, `shims: true`,
  `treeshake: false`, and the `keepAutoRecordExternal` esbuild plugin resolves
  `./auto-record` to `.js`/`.cjs` with `external: true` exactly as specified.
- `.github/workflows/ci.yml` has the node×express matrix `[22,24]×[4,5]`, a `peer-floor` job
  installing `express@4.21.0` then `express@5.0.0`+`router@2.0.0`+`zod@4.2.0` and running the
  not-yet-existing `test/introspect`/`test/adapter/standard-floor.test.ts` with
  `--passWithNoTests` (matches the story's explicit gotcha about those paths not existing
  yet), a `mutation-scoped` job with `timeout-minutes: 30` gated on `origin/main` diff, and a
  `perf` job. `mutation-full.yml` has `on: {schedule, workflow_dispatch}` only, cron
  `'0 3 * * *'`, `timeout-minutes: 120`, and both mutation jobs cache
  `reports/stryker-incremental.json` keyed on `hashFiles('src/**','test/**')` with a
  `main-` restore-key fallback — this matches ADR-50 in the actual YAML, not just the report's
  restatement of ADR-50.
- `release.yml`'s only trigger is `workflow_dispatch`; it checks the last `mutation-full` run
  conclusion and never runs `npm publish` — matches AC-028 and the report's claim.
- The mutation-smoke numbers in the Green evidence (`Instrumented 1 source file(s) with 2
  mutant(s)`, `killed 2`, score 100 ≥ 70) are internally consistent with a two-statement
  function (`add(a,b){ return a+b }`) and are the kind of concrete, falsifiable numbers a
  fabricated report would be unlikely to bother inventing precisely.

**One thing worth flagging, not as a fabrication but as a real thinness the report does not
call out:**

- `test/fixtures/fresh-express.ts`'s private-dependency cache-clearing (ADR-34's requirement
  to also clear `router` and `path-to-regexp` under the resolved alias root) contains a
  resolution path (`packageRoot(join(alias, '..', dep))`) that is very likely always a
  no-op/throw in practice — `require.resolve('express/../router/package.json')` is not a
  form Node's package resolution algorithm honors — and silently falls through to the
  `catch` branch that resolves `dep` as a bare top-level package instead. Functionally this
  probably still ends up clearing the right cache entries (since `router` is also a direct
  dependency at the repo root), but the code path the author apparently intended
  (resolving the *private* copy of `router` nested under the specific `alias`, so that
  `express` vs `express4`'s independently-nested `router` copies are each cleared correctly)
  looks dead. The Builder Report does not mention this, and the AC self-check does not name
  a story AC this feeds (ADR-34 is not itself a numbered AC in this story), so it is not a
  false claim — but the story's own test 9 (`test/core/fixtures.test.ts`) only checks the
  `RECORDER` property and `restore()` round-trip, never that the private-dep caches were
  actually invalidated, so this thin/likely-dead branch is untested and unremarked. This is
  a genuine coverage gap worth a downstream story (S-04+, whichever first depends on
  `freshExpress` isolating truly independent Express-4 vs Express-5 module graphs) watching
  for — if the two aliases ever share a nested `router`/`path-to-regexp` copy that needs
  independent clearing, this fixture may not do what ADR-34 asks.
- Coverage numbers (100/100/100/100, "6/6" statements, "0/0" branches and functions) are
  consistent with the real state of `src/` at the end of this story (only `core/types.ts` has
  runtime statements — six `const` symbol declarations — and the four handover stubs have
  none), so "100% coverage" is not misleading here, but it is a trivial 100% (nothing exists
  yet to branch on) rather than evidence of thorough exercise. This is expected for a wave-1
  scaffold story and the report does not overstate it beyond the raw numbers.

**No corner-cutting found.** File-scope ownership in the diff-stat is confined to
`file_scope.owns`/`creates`; the two named deviations (esbuild pin auto-bump caught and
fixed, `.gitignore` `/dist/` vs `test/dist/` collision caught and fixed) are disclosed, not
buried, and both are the kind of self-correction a monitor wants to see documented rather
than silently absent from the diff.

## Verdict

Accept. The Builder Report's central claims (build green, lint/typecheck green, 90%+
coverage met, CI/release workflow shape correct, mutation smoke killed ≥1 mutant) are
each backed by evidence that, on independent inspection of the actual files, holds up —
this is not a case of citing a command's exit code while quietly omitting what it covers.
The one flagged item (dead/no-op branch in `fresh-express.ts`'s private-dependency
resolution) is not a false claim in this story and does not map to any of ST-001's ACs, so
it does not block Wave 1, but it should be carried forward as a watch-item for whichever
later story is the first real consumer of `freshExpress` isolating express4 vs express5.
