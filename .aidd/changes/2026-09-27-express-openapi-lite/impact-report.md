# Impact Report — 2026-09-27-express-openapi-lite

<!-- Impact Analyst (pre-build, Inception step 10). Greenfield repo: no in-repo callers exist. -->

Context pack read first: `.aidd/context/snapshot.md` records the tracked tree as empty. Probe at the repo root: `ls -a` shows only `.aidd .claude .git .gitignore AGENTS.md`. There is no `package.json` and no `src/`.

## Blast-radius rating

**MEDIUM**. In-repo fan-in is zero (greenfield). The rating is driven by what happens outside the repo: ADR-18 patches Express `use()` on the prototype at import time (a global side effect in every consumer app), and the first publish fixes a semver contract (exports map plus named exports plus types).

## Lenses

| Lens | Finding | Evidence (file:line) |
|---|---|---|
| Caller / dependency impact | **In-repo: none found.** Fan-in is 0 because no source exists. Probe: `grep -rln "express-openapi-lite" --exclude-dir=.aidd --exclude-dir=.git .` returned exit 1 (no matches), so AC-001's name rule already holds. **External callers are consumers' Express apps.** (a) ADR-18 recorder: importing the package wraps `use` on the prototype that owns it (two levels up on Express 5) and wraps `express.application.use`. This is process-global and applies to each resolved Express module instance, so it reaches every router in the host app, including routers unrelated to docs. It is mitigated by annotate-only wrappers that call the original first and by an idempotency symbol. (b) Import-order dependence (R-8): Express 5 mounts made before the import degrade to the local path plus a `warn`. (c) Express 4: reading `app.router` throws, so the sniff must use keys. (d) Peer range covers both majors. Riskiest caller: a consumer app that loads two Express copies, or imports this package after mounting. | architecture.md:83 (ADR-18), architecture.md:120-128 (S-4a/S-4b spike), architecture.md:41 (C5), epic.md:72 (S-05 high risk, G-S05), ST-005-introspection.md:119,155, ST-008-docs-release.md:51-56,70 |
| Public-contract impact (breaking?) | **New contract; not breaking because there is no prior version.** It becomes the semver baseline at the first publish. Surface: the `exports["."]` map with `import`/`require` conditions, each with its own `types` (`.d.ts`/`.d.cts`); the named exports `createApiDocs`, `DEFAULT_OPTIONS` (deep-frozen), `ApiDocsConfigError`, `zodAdapter` plus types; `peerDependencies` express `^4.21.0 \|\| ^5.0.0` and zod `^4.0.0`; `engines.node >=20`; the default `/openapi.json` and docs paths. `sideEffects` must NOT be `false`, or bundlers tree-shake the recorder and silently break mount paths. That is a contract-level hazard. Every later change to option defaults (DEFAULT_OPTIONS) is itself a semver event. Guard tests: `test/dist/parity.test.ts`, `test/dist/pack.test.ts`, `test/e2e/exports.test.ts`. | ST-001-scaffold.md:78 (package.json shape, sideEffects), ST-001-scaffold.md:84-87 (AC-001..004), architecture.md:45 (C9 public exports), ST-007-serve-docs.md:106, epic.md:60 (src/index.ts handover S-01 to S-07), epic.md:129-130 |
| Data & migration impact | **None found.** No persistence, DB or migration. The only state is the in-memory spec cache (C7), keyed on a layer-count fingerprint, plus `invalidate()`. Rollback means unpublishing or deprecating the npm version. No publish happens in this run (AC-028). | architecture.md:43 (C7), ST-001-scaffold.md:75,92 |
| CI/CD & ops burden | **New:** `.github/workflows/ci.yml` runs a 6-cell matrix (Node 20/22/24 × Express 4/5) with build, lint, typecheck and test. `release.yml` has `workflow_dispatch` as its only trigger. The CI burden also includes 90% coverage thresholds, Stryker mutation, attw and publint (pack checks), and 4 vitest benches with a p95 < 200 ms gate. Flakiness risks: benches on shared runners, and the `express4@npm:express@4.22.3` alias in the matrix. Secrets: an npm token becomes necessary only when release.yml runs; nothing is required now. Workflow shape is asserted by `test/dist/workflows.test.ts`. | architecture.md:46 (C10), architecture.md:211-218 (benches), epic.md:132, ST-001-scaffold.md:75,114-118 |

## Reach outside planned ownership

Ownership matrix: epic.md:22-31. Each finding below was checked against it.

1. **`.gitignore` is owned by S-01, but it already exists.** It is owned (epic.md:25; ST-001-scaffold.md:31) and correctly does not appear in S-01's `creates` list. Current content (`cat -A .gitignore`) is one line: `.aidd/context/`. **Risk:** S-01's scaffold must *merge* its entries (`node_modules/`, `dist/`, `coverage/`, `reports/mutation/`, `.stryker-tmp/`) and must not overwrite the file, or the context pack becomes tracked. Recommend that ST-001 state this explicitly and add an assertion.
2. **`AGENTS.md`: unowned.** It is in the repo root and falls under AC-001's "no file outside `.aidd/`" grep, so the blast radius reaches it. It is clean today (grep exit 1), and no story needs to edit it. Flag it as read-only and unowned. No Epic Scoper action is needed unless it is edited.
3. **`.claude/**`: unowned.** It is also in AC-001's grep scope and is clean today. It is framework config, not product code, so the same treatment as item 2 applies. If AC-001's grep test scans it, a future framework update could fail the build. Recommend that the grep test exclude `.claude/` and `.git/`, or that ST-001 document the scope.
4. **`.github/**` and `package.json`** are singly owned by S-01 (epic.md:36). Later stories must route requests through their Builder Reports (epic.md:41). No gap.
5. **`src/index.ts`** is handed over sequentially from S-01 to S-07 (epic.md:60). No concurrent share.
6. No other root-level file (README.md, CHANGELOG.md, LICENSE, configs) is left without an owner.

## QA confirmation (post-build)

<!-- To be completed in QA mode against the actual diff. Check in particular: .gitignore retains `.aidd/context/`; sideEffects not false; no files outside the ownership matrix touched. -->
