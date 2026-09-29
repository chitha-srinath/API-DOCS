# Evidence manifest — stage: post (QA step 8)

Repo: `C:\sai\code practice\Package\API-DOCS`, branch `aidd/2026-09-27-express-openapi-lite-rebuild`.

Context: package is fully built (79/79 test files passing at construction close; 78
non-perf files / 637 tests passing in this capture run — perf tests live in a separate
`test/perf/**` suite excluded from `npm test`, per ADR-26), all QA gates green per
`qa/verification-report.md`. Every flow below was captured against real, running code —
`examples/basic` (server started with `npx tsx examples/basic/server.ts`, `PORT=4123`)
for the API/UI flows, and the real `npm run build` / `npm test` / `npm run perf` commands
for the CLI and bench flows. No output was fabricated; every `.txt` file is the literal
command and its full real stdout/stderr/exit code.

| Flow id | Description | Kind | Command captured | Result | Evidence file | sha256 |
|---|---|---|---|---|---|---|
| F-1 | `npm run build` then `npm pack --dry-run` | cli | `npm run build`; `npm pack --dry-run` | PRESENT — both exit 0; ESM+CJS+`.d.ts` emitted; tarball has 21 files, no bundled UI assets (AC-020) | `evidence/post/F-1.txt` | `d888775e535b542582e40fa7bcb52c241190ce2356375a0d7bcc02823973ad07` |
| F-2 | `npm test` with coverage report | cli | `npm test` | PRESENT — exit 0; 78 test files passed, 637 passed / 5 skipped; coverage 98.56% stmts / 93.35% branch / 99.45% funcs / 99.34% lines (all ≥ 90% AC-025 target) | `evidence/post/F-2.txt` | `3ac656903c2ffcf400de50e4ad0c9df259d6c6f4688cac1e04e22ddd4e0b0a0a` |
| F-3 | Example app: `GET /openapi.json` returns a valid 3.1 spec | api | `curl -sv http://localhost:4123/openapi.json` | PRESENT — HTTP 200, `Content-Type: application/json`, body has `"openapi":"3.1.0"` and `paths` for `/health`, `/widgets`, `/widgets-plain` | `evidence/post/F-3.txt` | `9f20ddf77e8732b5b868969b9fd31f014f32ef6d22de31c248d3559921a9a5e1` |
| F-4 | Example app: invalid request returns 400 problem+json | api | `curl -sv -X POST http://localhost:4123/widgets -d '{}'` | PRESENT — HTTP 400, `Content-Type: application/problem+json`, body `{"type":"about:blank","title":"Bad Request","status":400,"detail":"Request validation failed.","errors":[{"in":"body","path":"name","message":"Invalid input: expected string, received undefined"}]}` (AC-007) | `evidence/post/F-4.txt` | `3cf98b39091315dd048d2b26089d252520114b814b1ccc1a657878a64610cf19` |
| F-5 | Example app: `GET /docs` renders Scalar (and Swagger UI via option) | ui | `curl -sv http://localhost:4123/docs` | PRESENT (degraded to HTTP transcript — see note) — HTTP 200, `Content-Type: text/html`, body loads `@scalar/api-reference@1.72.1` from `cdn.jsdelivr.net` pointed at `data-url="/openapi.json"` (AC-018) | `evidence/post/F-5.txt` | `3254eb4a29d4b5bd1110fecfa98b0e8da65ed83d4cb7a2fb649c0d852a04b24a` |
| F-6 | Example app: a plain (unannotated) route appears in `/openapi.json` via auto-detection | api | `curl -s http://localhost:4123/openapi.json` (extract `paths["/widgets-plain"]`) | PRESENT — the plain `app.get('/widgets-plain', ...)` route (no typed helper, no `describe()`) appears with `operationId: getWidgets-plain`, a generic `200` response and tag `widgets-plain` | `evidence/post/F-6.txt` | `3b056724e25b9d787adf2fe5395f9660118f30b28b4806524456596a62030c5e` |
| F-7 | Zero-options vs custom-options `createApiDocs()` / schemaAdapter override | api | `npx vitest run test/route/stub-adapter.test.ts --reporter=verbose` | PRESENT — 7/7 tests pass across Express 4 and 5: stub adapter drives validation end-to-end (400 on invalid, parsed body on valid, AC-005); `meta.adapter` (per-route) overrides the global `schemaAdapter` and the global adapter's `validate` is never called (AC-047); global adapter is used when no per-route override is given | `evidence/post/F-7.txt` | `91286b8b7dd01356d4d9a50cfd0cad91838716e7fe405f9bb7bb1052395cf14e` |

## Benches (architecture.md "Bench Commands" / ADR-26 perf gate)

| Bench id | Command | Result | Evidence file | sha256 |
|---|---|---|---|---|
| B-1 spec-endpoint | `npx vitest bench --run bench/spec-endpoint.bench.ts` | **DEGRADED** — fails with `TypeError: bench is not a function` under the pinned vitest 5.0.2; `vitest bench` appears incompatible/removed in this version. ADR-26 states these `bench/*.bench.ts` files are informational trend reports only, not the gate, so this does not block anything — see the real gate result below. | `evidence/post/bench-B-1.txt` | `41a30d472f0424ddcef5f64053018f4dff40956a79525781cb399289048390f4` |
| B-2 spec-cold | `npx vitest bench --run bench/spec-cold.bench.ts` | **DEGRADED** — same `bench is not a function` failure, same ADR-26 non-gate status | `evidence/post/bench-B-2.txt` | `b21da9eded575145fdcbcbcbc8bfa31e70ac230ae0ab5aa469ed0ac28e8d30d7` |
| B-3 typed-route | `npx vitest bench --run bench/typed-route.bench.ts` | **DEGRADED** — same `bench is not a function` failure, same ADR-26 non-gate status | `evidence/post/bench-B-3.txt` | `b98f987d1012d33bcc1ab76a31272a931cfc096f76a72d0c80894cd65b2dbeaa` |
| B-4 docs-endpoint | `npx vitest bench --run bench/docs-endpoint.bench.ts` | **DEGRADED** — same `bench is not a function` failure, same ADR-26 non-gate status | `evidence/post/bench-B-4.txt` | `e4586ea831b1b53c9b42c91ee7a5550bbbbfa9f4971bbd829c6c4b9cbf6bc8e7` |
| perf-gate (ADR-26 actual gate) | `npm run perf` (`vitest run --config vitest.perf.config.ts`, re-run with `--reporter=verbose` to surface the printed p95 numbers) | **PASS** — exit 0, 4/4 perf test files pass; real p95 numbers printed for all 4 scenarios (see perf-budget table below) | `evidence/post/perf-gate.txt` | `fbdcd9c40f42f7e43c19c9f8fc7e60a2352050d204f42368d94de21d9084d478` |

Note on the `vitest bench` degradation: `bench-capture.sh`'s own harness (`python3 -c
'import time...'`) is also unavailable in this Windows Git Bash environment (`python3`
resolves to the Microsoft Store app-execution-alias stub, not a real interpreter), so the
template script could not be invoked as written either. Both degradations are recorded
here rather than fabricating timings; the actual enforceable gate (`npm run perf`) was run
directly and is not degraded.

## Perf-budget table (pre vs post vs budget, ADR-26)

Pre-stage recorded this row as `na` (no `package.json`, no harness existed yet). Post
numbers are the real p95 values printed by `npm run perf` (3 measurement rounds per
scenario, nearest-rank p95, N=300 samples after 50 warm-up requests, in-process
`http.Server` + supertest, this run on local Windows — architecture.md notes local
Windows results are informational only; the single blocking CI cell is ubuntu-latest/
node 24/express 5).

| Scenario | Pre p95 | Post p95 (3 rounds, ms) | Budget (ADR-26, constitution) | Verdict |
|---|---|---|---|---|
| B-1 / spec-endpoint (warm cache) | na — harness did not exist | 6.23, 6.91, 5.37 | p95 < 200ms | PASS (all 3 rounds ≪ budget) |
| B-2 / spec-cold (cold cache each request) | na — harness did not exist | 6.18, 7.36, 5.32 | p95 < 200ms | PASS (all 3 rounds ≪ budget) |
| B-3 / typed-route (request validation) | na — harness did not exist | 6.27, 7.66, 5.28 | p95 < 200ms | PASS (all 3 rounds ≪ budget) |
| B-4 / docs-endpoint | na — harness did not exist | 5.98, 6.85, 4.98 | p95 < 200ms | PASS (all 3 rounds ≪ budget) |

All four scenarios clear the 200ms budget by roughly 27-40x margin in every round; the
"2 of 3 rounds" failure rule (ADR-26) is not triggered anywhere.

## Self-verification

- Every affected flow (F-1..F-7) from `prd.md`'s affected-flows table has one manifest
  row and one real evidence file under `evidence/post/`, captured against the built
  package and a live `examples/basic` server (F-3..F-6) or the real test/build/pack
  commands (F-1, F-2, F-7).
- All 4 bench rows (B-1..B-4) from `architecture.md`'s "Bench Commands & budgets" table
  have a manifest row; the `vitest bench` degradation is recorded with its reason (ADR-26:
  those files are informational, not the gate), and the actual gate command (`npm run
  perf`) was run for real, with its output captured and its p95 numbers carried into the
  perf-budget table above.
- No passing output was fabricated anywhere in this manifest or its evidence files; the
  `vitest bench` and `bench-capture.sh`/python3 degradations are stated explicitly, not
  silently skipped.
- The example server used for F-3..F-6 was started on `PORT=4123` (non-default, to avoid
  clashing with anything already on 3000) and stopped after capture (`Stop-Process` on the
  listening PID); `git status --short` after this capture run shows only the new
  `evidence/post/**` files and no drift elsewhere in the tree.
