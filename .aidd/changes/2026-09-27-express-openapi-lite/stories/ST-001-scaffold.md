---
id: ST-001
title: "S-01 Scaffold: package, build, lint, test, perf, mutation and CI config; core types, Symbol.for identities and the RouteRegistry contract"
wave: 1
status: queued
attempts: 0
ac_ids:
  - AC-001
  - AC-002
  - AC-004
  - AC-020
  - AC-025
  - AC-026
  - AC-027
  - AC-028
file_scope:
  owns:
    - package.json
    - package-lock.json
    - .nvmrc
    - tsconfig.json
    - tsconfig.build.json
    - tsup.config.ts
    - vitest.config.ts
    - vitest.perf.config.ts
    - eslint.config.js
    - .prettierrc
    - .prettierignore
    - stryker.config.mjs
    - LICENSE
    - .gitignore
    - .github/**
    - src/core/types.ts
    - test/dist/global-setup.ts
    - test/dist/manifest.test.ts
    - test/dist/pack.test.ts
    - test/meta/**
    - test/core/**
  creates:
    - src/core/
    - test/dist/
    - test/meta/
    - test/core/
    - .github/workflows/
    - src/index.ts
    - src/manual.ts
    - src/zod.ts
    - src/auto-record.ts
---

# ST-001 (epic S-01): Scaffold for package, build, lint, test, perf, mutation and CI config; core types, Symbol.for identities and the RouteRegistry contract

Epic id **S-01**. The frontmatter id is `ST-001` because the schema requires `^ST-[0-9]{3}$`.
Wave 1, runs solo, no dependencies. Risk: **medium-high** (epic.md): "Several package-shape details must all be right: the exports map for 3 entries, the scoped `sideEffects`, attw `node10` (PF-6), the optional peers and the peer-floor job. A mistake in any one breaks AC-002 or AC-004."

**Not in this story (moved to S-07, epic.md):** AC-003 and the tests `parity`, `dual-load`, `bundle` and `no-zod-load`. They live in `test/entries/**`, owned by S-07. Do NOT create them under `test/dist/`.

## Context

**The repo is greenfield.** There is no `package.json` and no `src/` (context pack `.aidd/context/snapshot.md`; nothing was re-crawled). This story creates components **C0** and **C10** from `architecture.md`, as amended by ADR-20 to ADR-29.

**C0 (architecture.md, quoted):**
> | C0 | `core/types.ts` | The shared contracts only: `HttpMethod`, `OperationMeta` (the per-route declaration), `DetectedOperation {method, path, pathParams[], source: 'typed'\|'describe'\|'plain', meta?}`, `Logger`, and `META: unique symbol`. There is no logic here. | — | Hexagonal "ports" module (zod-to-openapi's `types.ts`) | S-01 scaffold |

**C10 (architecture.md, quoted; the Node matrix is superseded by ADR-22, see below):**
> | C10 | `package.json`, `tsconfig*.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `stryker.config.mjs`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `LICENSE`, `.gitignore` | The dual build, 90% coverage thresholds, the mutation config, the CI matrix of node {20,22,24} × express {4,5}, and a `release.yml` whose only trigger is `workflow_dispatch`. | 001–004, 020, 025–028 | tsup + attw + publint (as used by zod, hono and trpc) | S-01 scaffold |

### ADR-20: Symbol.for identities (owned here, `src/core/types.ts` and `eslint.config.js`)
> There are exactly four, defined in `src/core/types.ts` (S-01): `META = Symbol.for('express-api-docs.meta')`, `MOUNT = Symbol.for('express-api-docs.mount')`, `CHILD = Symbol.for('express-api-docs.child')` and `RECORDER = Symbol.for('express-api-docs.recorder')` (the idempotency guard stored on each patched prototype). Local `Symbol()` is **banned** for any value that crosses module boundaries. An ESLint `no-restricted-syntax` rule on `src/**` enforces this, with an allow-list comment for purely local symbols.

Note: `Symbol.for(...)` returns `symbol`, not `unique symbol`. Declare them so C0's `META: unique symbol` type holds (for example `export const META: unique symbol = Symbol.for('express-api-docs.meta') as never`). The ADR-20 `dual-load` test belongs to S-07.

### ADR-27c: pinned RouteRegistry contract (copy verbatim into `src/core/types.ts`)
```ts
export interface RegistryEntry {
  readonly id: number;                 // registration order, for A-3 collision suffixes
  readonly method: HttpMethod;
  readonly localPath: string;          // Express syntax, as declared
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
  readonly validatorFn?: RequestHandler; // typed only
  readonly handlerFn: RequestHandler;
}
export interface RouteRegistry {
  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry;
  entries(): readonly RegistryEntry[];                    // registration order
  findByHandle(fn: unknown): RegistryEntry | undefined;   // identity match on validatorFn OR handlerFn
}
```
`RequestHandler` must be a type-only import (`import type { RequestHandler } from 'express'`), so no runtime import of express reaches `core`. S-04 implements this contract; S-05 and S-06 consume it.

### ADR-21 and ADR-04: import-boundary lint rules and the optional zod peer (owned here: `package.json`, `eslint.config.js`, `test/dist/pack.test.ts`)
ADR-21:
> `zod` becomes an **optional peer**: `peerDependencies.zod: ^4.0.0` plus `peerDependenciesMeta.zod.optional: true`. The core (`.` entry) **never imports `zod`**. An ESLint `no-restricted-imports` rule on `src/**` except `src/adapter/zod.ts` enforces this, and a pack test greps `dist/index.{js,cjs}` for `zod`.
> **Exports map:** `.` and `./zod`, each with `import`/`require`/`types`.

ADR-04 (the boundary ban stays in force and is enforced by S-01's eslint config, per the ST-002 refresh):
> **`config/**` must not import `zod` or `adapter/**`**, and an ESLint `no-restricted-imports` rule on `src/config/**` enforces this.

`eslint.config.js` must therefore carry both rules:
- `src/**` except `src/adapter/zod.ts`: `no-restricted-imports` bans `zod` (and `zod/*`).
- `src/config/**`: `no-restricted-imports` bans `zod` and any path into `src/adapter/**` (patterns such as `../adapter`, `../adapter/*`, `**/adapter/**`). Flat config replaces rather than merges `no-restricted-imports` options for overlapping globs, so the `src/config/**` block must list the zod ban again.

### ADR-22: Node floor, `.nvmrc`, extra devDeps
> `engines.node` is `>=22`. The CI matrix is node {22, 24} × express {4, 5}. `actions/setup-node` uses `node-version: 22` and `24` ... Dev-tooling floor: Node >= 22.19 ... `.nvmrc` = `24`.
> add `vite@^8.3.1` (vitest peer `^6.4||^7||^8`) and `@types/node@~22.20.4`.

### ADR-24: entries and scoped `sideEffects` (owned here: `tsup.config.ts`, `package.json`, the pack test, the esbuild devDependency)
> the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. ... the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import.
> `package.json` has `"sideEffects": ["./dist/auto-record.js", "./dist/auto-record.cjs"]`. It is **never `false` and never `true`**.
> `esbuild` is already a transitive dependency of tsup; S-01 adds it as an explicit devDependency, pinned at scaffold time with a probe.

The tsup entries are `index`, `manual`, `zod` and `auto-record` (epic ownership matrix). The exports map therefore has `.`, `./manual` and `./zod`, each with `import`, `require` and `types`.

### ADR-25: CI matrix and peer-floor job (owned here: `.github/workflows/ci.yml`, `test/meta/workflows.test.ts`)
> In the CI cell `express: 5`, both majors run. In the cell `express: 4` the step `npm i --no-save express@4.22.3` swaps the root ...
> **Typecheck:** it runs only in the `express: 5` cell, which matches `@types/express` 5.
> **Workflow test:** `test/meta/workflows.test.ts` asserts that the install step references `${{ matrix.express }}`.
> **Peer-floor job (CR-9):** a separate blocking job `peer-floor` on node 24 installs `express@4.21.0`, then `express@5.0.0` with `router@2.0.0`, and runs `test/introspect/**`.

`test/introspect/**` is empty until S-05, so the job must pass when there are no test files (for example `vitest run test/introspect --passWithNoTests`).

### ADR-26: perf script (owned here: the `package.json` script, `vitest.perf.config.ts`, the CI cell)
> perf tests are ordinary vitest tests in `test/perf/*.perf.test.ts` (S-07). They are excluded from `npm test` and run by `npm run perf` (`vitest run --config vitest.perf.config.ts`) ... **CI:** runs in exactly one pinned, blocking cell: ubuntu-latest, node 24, express 5.

`vitest.config.ts` must exclude `test/perf/**`. `vitest.perf.config.ts` includes only `test/perf/**/*.perf.test.ts`, with `passWithNoTests: true` until S-07 adds tests.

### ADR-27d: Stryker scope (owned here: `stryker.config.mjs`)
> The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70.

ADR-05 tooling: `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.0.0.

### ADR-28: canonical commands (owned here: `package.json` scripts only)
> (3) The canonical commands `check:pack`, `mutation`, `perf` and `audit` are added.

### ADR-29 items owned here
> **PF-3:** `@types/express` (`^4.17.21 || ^5.0.0`) is added as an **optional** peer through `peerDependenciesMeta`.
> **PF-6:** the top-level `"types"` field is `./dist/index.d.cts`, and the `"module"` field is dropped, so that attw's `node10` profile passes.
> **Test-strategy #5:** `test/dist/**` runs `npm run build` **unconditionally** in `globalSetup`.

epic.md adds: `test/dist/global-setup.ts` is "registered suite-wide in `vitest.config.ts` so `test/entries/**` also gets a fresh build".

### Tooling ADRs (unchanged pins)
- ADR-11: "**Build uses `tsup` 8.5.1** (ESM `.js` with `"type": "module"`, CJS `.cjs`, `.d.ts` and `.d.cts`). **Package gates** are `publint` 0.3.24 and `attw --pack` 0.18.5."
- ADR-12: "**devDependency TypeScript is pinned to `~5.9.3`**, not `latest` (7.0.2). The consumer floor stays TS >= 5.4 (Q5)."
- ADR-13: "The devDeps are `express@^5.2.1` and `express4: npm:express@^4.22.3`, and fixtures are parameterized over both. CI also swaps the peer per matrix cell."
- ADR-14: "every spec-producing test calls `@apidevtools/swagger-parser` 13.1.0 `validate()`."
- ADR-15: "**Tests use vitest 5.0.2 with `@vitest/coverage-v8` 5.0.2** (peer pinned to the same version), `supertest` 7.3.0, and `vitest --typecheck` for `*.test-d.ts`. Coverage thresholds are 90 for lines, branches, functions and statements."
- ADR-16: "**Lint uses eslint 10.11.0 flat config with `typescript-eslint` 8.70.1 and prettier 3.9.9.**"
- ADR-10: zero runtime dependencies.

Probed versions (architecture.md): `@types/supertest 7.2.1`, `@types/express 5.0.6`, `zod 4.6.5`. `@scalar/api-reference 1.72.1` and `swagger-ui-dist 5.33.0` are **CDN pins only** and must NOT appear in any dependency field (AC-004, AC-020).

### Conventions and gotchas
- **Pre-declare the full devDependency set** (ADR-05, ADR-11 to ADR-16, ADR-21, ADR-22, ADR-24): typescript, tsup, publint, @arethetypeswrong/cli, vitest, @vitest/coverage-v8, vite, supertest, @types/supertest, @types/express, @types/node, express, the express4 alias, zod, @apidevtools/swagger-parser, eslint, typescript-eslint, prettier, @stryker-mutator/core, @stryker-mutator/vitest-runner, esbuild and yaml. Later stories may not edit `package.json`, which has a single owner.
- **Stub entries.** Create `src/index.ts`, `src/manual.ts` and `src/zod.ts` (owned by S-07 from Wave 6) and `src/auto-record.ts` (owned by S-05 from Wave 4) as empty-export stubs, so tsup has all four entries. This is a sequential handover, not sharing.
- Set coverage `include: ['src/**']` so that empty folders do not fail. The thresholds apply to the code that exists at the end of each wave.
- The package name is `express-api-docs`. The old name must appear in NO file outside `.aidd/`, including tests: build it at runtime (`['express','openapi','lite'].join('-')`).
- LICENSE: MIT, with a copyright line naming `chitha_srinath`.
- `release.yml`: only `on: workflow_dispatch`. No workflow runs `npm publish` on push or tag. Do not run `npm publish`.
- The platform is win32. Keep scripts cross-platform (no `rm -rf`, no inline env assignments).

Suggested `package.json` shape:
- `"type": "module"`, `"main": "./dist/index.cjs"`, `"types": "./dist/index.d.cts"`, and **no `module` field**.
- `"exports"` for `.`, `./manual` and `./zod`, each shaped `{"import": {"types": "./dist/<e>.d.ts", "default": "./dist/<e>.js"}, "require": {"types": "./dist/<e>.d.cts", "default": "./dist/<e>.cjs"}}`.
- `"files": ["dist", "LICENSE", "README.md"]` and `"engines": {"node": ">=22"}`.
- `"peerDependencies": {"express": "^4.21.0 || ^5.0.0", "zod": "^4.0.0", "@types/express": "^4.17.21 || ^5.0.0"}` and `"peerDependenciesMeta": {"zod": {"optional": true}, "@types/express": {"optional": true}}`.
- `"sideEffects": ["./dist/auto-record.js", "./dist/auto-record.cjs"]`.
- Scripts: `build`, `test`, `lint`, `check:pack`, `mutation`, `perf` and `audit`, exactly as in Verification commands.

## Acceptance criteria (from PRD)

| id | Criterion |
|---|---|
| AC-001 | Given the package is built, When `package.json` is inspected, Then `name` is `express-api-docs`, `license` is `MIT`, a LICENSE file with copyright chitha_srinath exists, and the string `express-openapi-lite` appears in no file outside `.aidd/`. |
| AC-002 | Given `npm run build`, When it finishes, Then it exits 0 and emits ESM (`.js`/`.mjs`), CJS (`.cjs`) and `.d.ts` outputs, and `exports` maps `import`, `require` and `types` to those files. |
| AC-004 | Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 \|\| ^5.0.0` and `zod` `^4.0.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed. |
| AC-020 | Given the published file list (`npm pack --dry-run`), When it is inspected, Then it contains no bundled UI JS/CSS assets. |
| AC-025 | Given `npm test`, When it runs, Then all tests pass and line, branch, function and statement coverage are each at least 90%. |
| AC-026 | Given `npm run lint` and `npx tsc --noEmit`, When they run, Then both exit 0. |
| AC-027 | Given the CI workflow, When it runs on push or pull request, Then it runs build, lint, typecheck and tests on Node 22 and 24, against Express 4 and 5. |
| AC-028 | Given the release workflow file, When it is inspected, Then its only trigger is `workflow_dispatch` and no workflow publishes on push or tag. No `npm publish` is executed during this run. |

Scope notes (from the epic.md AC coverage table):
- AC-001 and AC-002 are shared with S-07, which owns the final exports.
- AC-004 here covers the package manifest only: the peers, the optional meta, engines `>=22`, and `./zod` in the exports map. The `zodAdapter` export belongs to S-03 and S-07, and the no-zod load test belongs to S-07.
- AC-020 is shared with S-07, which owns the CDN side.

## Test plan

Write these tests FIRST. Run `npm test` and capture the red output before writing any config or source. Every S-01 test must go green against the stub entries.

1. **`test/dist/global-setup.ts`** (ADR-29 #5). Runs `npm run build` **unconditionally**, and is registered as `globalSetup` in `vitest.config.ts` for the whole suite.
   *Red:* there is no `package.json`.
2. **`test/dist/manifest.test.ts`** (AC-001, AC-004).
   - `pkg.name === 'express-api-docs'` and `pkg.license === 'MIT'`. `LICENSE` contains `MIT License` and matches `/Copyright \(c\) \d{4} chitha_srinath/`.
   - `peerDependencies.express === '^4.21.0 || ^5.0.0'`, `peerDependencies.zod === '^4.0.0'`, `peerDependenciesMeta.zod.optional === true`, `peerDependencies['@types/express'] === '^4.17.21 || ^5.0.0'` and `peerDependenciesMeta['@types/express'].optional === true`.
   - `engines.node === '>=22'`.
   - `exports` has exactly the keys `.`, `./manual` and `./zod` (plus `./package.json` if added). Each has `import` and `require`, and each of those has `types` and `default`.
   - `pkg.types === './dist/index.d.cts'` and `'module' in pkg === false`.
   - `dependencies` is absent or empty, and no key in `dependencies` or `peerDependencies` matches `/scalar|swagger-ui|redoc/i`.
   - A recursive walk of the repo root (skipping `.aidd/`, `.git/`, `node_modules/`, `dist/`, `coverage/`, `reports/` and `.stryker-tmp/`) finds no file containing the old name, which the test builds with `join`.
   *Red:* `package.json` and `LICENSE` are missing.
3. **`test/dist/pack.test.ts`** (AC-002, AC-020, ADR-21, ADR-24). Parse `files[].path` from `npm pack --dry-run --json`.
   - The list contains `dist/{index,manual,zod,auto-record}.{js,cjs}` and `dist/{index,manual,zod}.{d.ts,d.cts}`.
   - Every `exports` target is in the pack list.
   - No path matches `/\.css$/` or `/(scalar|swagger-ui|redoc)/i`, and there is no `.js` or `.cjs` file outside `dist/`.
   - `pkg.sideEffects` deep-equals `["./dist/auto-record.js","./dist/auto-record.cjs"]`.
   - The contents of `dist/index.js` and `dist/index.cjs` do not match `/\bzod\b/` (no import or require of `zod`).
   *Red:* there is no `package.json`, so `npm pack` exits non-zero.
4. **`test/meta/workflows.test.ts`** (AC-027, AC-028, ADR-25, ADR-26). Parse the files with `yaml`.
   - `ci.yml`:
     - `on` contains `push` and `pull_request`.
     - A job matrix has `node: [22, 24]` and `express: [4, 5]`.
     - An install step's `run` references `${{ matrix.express }}`.
     - The steps run `npm run build`, `npm run lint`, `npx tsc --noEmit` (gated to the `express: 5` cell) and `npm test`.
   - A job named `peer-floor` exists. It runs on node 24, does not set `continue-on-error: true`, installs `express@4.21.0` and then `express@5.0.0` with `router@2.0.0`, and runs `test/introspect`.
   - A perf job or step runs `npm run perf`, pinned to `ubuntu-latest`, node 24 and express 5, and is not `continue-on-error`.
   - `release.yml`: `Object.keys(on)` deep-equals `['workflow_dispatch']`.
   - No workflow triggered by `push`, `release` or tags has a step that runs `npm publish`.
   *Red:* `.github/workflows/` is missing.
5. **`test/meta/lint-rules.test.ts`** (ADR-20, ADR-21, ADR-04). Use the ESLint Node API (`new ESLint()` and `lintText(code, { filePath })`, with paths under `src/`), so each rule is proven to fire.
   - ADR-20: `const s = Symbol('x')` in `src/foo.ts` reports `no-restricted-syntax`, and `Symbol.for('x')` in the same file reports nothing.
   - ADR-21: `import { z } from 'zod'` in `src/spec/x.ts` reports `no-restricted-imports`, and the same code with `filePath: 'src/adapter/zod.ts'` reports no `no-restricted-imports` error.
   - ADR-04: in `src/config/x.ts`, `import { z } from 'zod'` reports `no-restricted-imports`; `import { zodAdapter } from '../adapter/zod'` reports it; and `import type { SchemaAdapter } from '../adapter/types'` reports it (the ban covers every path into `adapter/**`). A control import, `import { x } from '../core/types'` in `src/config/x.ts`, reports no `no-restricted-imports` error.
   *Red:* there is no `eslint.config.js`, so the rule assertions fail.
6. **`test/core/types.test-d.ts`** (C0, ADR-20, ADR-27c), using `expectTypeOf`:
   - `HttpMethod` accepts `'get'` and rejects `'fetch'` (`@ts-expect-error`).
   - `DetectedOperation['source']` equals `'typed' | 'describe' | 'plain'`.
   - `META`, `MOUNT`, `CHILD` and `RECORDER` are each a `unique symbol`.
   - `Logger` has `debug` and `warn`.
   - `RegistryEntry['source']` equals `'typed' | 'describe'`.
   - `RouteRegistry['entries']` returns `readonly RegistryEntry[]`, and the `register` parameter is `Omit<RegistryEntry,'id'>`.

   **`test/core/types.test.ts`** is a runtime test that keeps coverage on `types.ts`. It asserts `META === Symbol.for('express-api-docs.meta')`, and the same for `mount`, `child` and `recorder`.
   *Red:* `src/core/types.ts` is missing.
7. **Gates** for AC-025 and AC-026: `npm test` (thresholds 90/90/90/90), `npm run lint` and `npx tsc --noEmit`.

## Verification commands

Copied verbatim from `architecture.md` "Verification Commands". This story turns them from "probe after scaffold story" into real probes; record each exit code in the Builder Report.

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story (the CLIs themselves were probed below)
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Wave 1 notes:
- Mutation may report "no mutants", because none of the mutated folders exist yet. That is acceptable only if `stryker run` exits 0.
- `npm run perf` must exit 0 while there are no perf files (`passWithNoTests`).
- Merge rule (ADR-29 #7): the full `npm test` must pass in this worktree.

## Builder Report

