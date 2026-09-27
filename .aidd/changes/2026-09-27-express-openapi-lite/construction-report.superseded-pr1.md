# Construction report — 2026-09-27-express-openapi-lite

Built on the human instruction "complete the feature" (2026-09-27). **Gates G1 (re-approval)
and G2 were not approved by a human**; construction proceeded on that instruction and the
gates stay `awaiting`. QA (playbook 40) has not run.

## Evidence (all commands run in the repo root, Node 22.22.2)

| Check | Command | Result |
|---|---|---|
| build | `npm run build` | exit 0; ESM `.js`, CJS `.cjs`, `.d.ts`/`.d.cts` for `index`, `manual`, `zod`, `auto-record` |
| tests + coverage + type tests | `npm test` | 34 files, 366 passed / 2 skipped (major-specific `skipIf`); coverage stmts 98.8 / branches 96.2 / funcs 99 / lines 99.7 |
| lint | `npm run lint` | exit 0 (eslint + prettier) |
| typecheck | `npx tsc --noEmit` | exit 0 |
| package | `npm run check:pack` | publint "All good!"; attw green for node16 (CJS/ESM) and bundler |
| audit | `npm audit --audit-level=critical` | exit 0 (1 low, dev-only) |
| mutation | `npm run mutation` | 82.83% (1483 killed, 13 timeout, 310 survived), break 70 |
| perf | `npm run perf` | p95 per round (ms): spec-warm 1.85/1.97/1.49, spec-cold 14.30/11.04/11.88, typed-route 1.50/1.17/1.13, docs 0.87/0.91/1.11 (budget 200) |

## AC → test matrix

| AC | Test |
|---|---|
| 001, 002, 004 | `test/dist/manifest.test.ts`, `test/entries/no-zod-load.test.ts` (004) |
| 003 | `test/entries/dual-load.test.ts` |
| 005 | `test/spec/build.test.ts` (stub adapter, `test/fixtures/stub-adapter.ts`) |
| 006 | `test/route/typed.test-d.ts` |
| 007–010, 040 | `test/route/request-validation.test.ts` |
| 011 | `test/route/problem.test.ts`, `test/spec/build.test.ts` |
| 012–014 | `test/route/response-validation.test.ts`, `test/route/send-delegation.test.ts` |
| 015–017, 030–034, 038, 039, 041, 042 | `test/spec/build.test.ts` |
| 018, 019 | `test/docs/render.test.ts` |
| 020 | `test/dist/pack.test.ts` |
| 021 | `test/route/incremental.test.ts` |
| 022, 023 | `test/introspect/walk.test.ts` (Express 4 and 5) |
| 024 | `test/route/async.test.ts`, `test/route/wrap-async.test.ts` |
| 025 | `npm test` coverage thresholds (90/90/90/90) |
| 026 | `npm run lint`, `npx tsc --noEmit` |
| 027, 028 | `test/meta/workflows.test.ts` (a real green CI run is still owed as Delivery evidence) |
| 029 | `test/docs/readme-table.test.ts`, `test/examples/basic.test.ts` |
| 035–037, 043, 045 | `test/serve/router.test.ts`, `test/config/*.test.ts` |
| 044 | `test/config/validate.test.ts`, `test/config/merge.test.ts`, `test/route/*` (c, d) |
| 046 | `test/config/options.test-d.ts` |

## Deviations from architecture.md (need G2 review)

1. **`RegistryEntry.method` / `localPath` are optional.** `api.route(def, handler)` is spread into
   `router.get(path, ...)`, so method and path are unknown at declaration; the stack walk supplies
   them. `def.method`/`def.path` may be given for `getSpec()` before any walk.
2. **`MountAnnotation` stores `{ path, target }`**, not a bare path. Keeping the mounted router
   reference makes prefixes survive APM wrappers installed *after* the recorder (CR-3), with no warn.
3. **`api.router` is a plain middleware**, not an `express.Router()`: the core needs no runtime
   import of `express` and works with any Express copy.
4. **Stryker uses the command runner.** `@stryker-mutator/vitest-runner` 10.0.0 did not activate
   mutants under vitest 5.0.2 (score 19.7%, with an emptied function body "surviving"); a manual
   run with `__STRYKER_ACTIVE_MUTANT__` killed those mutants, so the command runner is used.
5. **auto-record** resolves `express` via `import.meta.url`, then a bundler's `require`, then the
   working directory. A consumer bundling the ESM build to CJS drops `import.meta.url` (found by
   `test/entries/bundle.test.ts`).
6. Added options beyond the PRD list: `docs.title`, `openapi.info.{summary,termsOfService,contact,license}`,
   global `tags` (needed for AC-044b), `adapter`, `logger`.

## Known limits (documented in README)

- `app.all()` is expanded by Express itself into one route per method, so it is documented per method.
- Recursive schemas producing `$defs` are not hoisted into `components`.
- Surviving mutants cluster in `introspect/index.ts` (warn-message text and defensive branches)
  and `spec/status.ts` (status-text table).
