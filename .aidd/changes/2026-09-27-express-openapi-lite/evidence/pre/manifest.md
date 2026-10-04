# Evidence manifest — stage: pre (baseline)

Repo: `C:\sai\code practice\Package\API-DOCS`, branch `aidd/2026-09-27-express-openapi-lite-rebuild`.

Context: greenfield rebuild. Before construction, no `package.json`, no `src/`, no build
output, no example app, and no server process exist on this branch — only `.aidd/`,
`.claude/`, `.gitignore`, `AGENTS.md` are tracked. Per prd.md's affected-flows note
("the pre-change baseline is empty"), every flow below is captured as **absent**: the
command was actually run and its real failure (exit code + stderr) is the evidence, not
a fabricated pass.

| Flow id | Description | Kind | Command captured | Result | Evidence file | sha256 |
|---|---|---|---|---|---|---|
| F-1 | `npm run build` then `npm pack --dry-run` | cli | `npm run build`; `npm pack --dry-run` | ABSENT — npm ENOENT: no `package.json` at repo root, exit 127 (both commands) | `evidence/pre/F-1.txt` | e6d878fccdb111713468627977b24f58978af9f8ec1b97a03cf9c3ac3b0a6d15 |
| F-2 | `npm test` with coverage report | cli | `npm test` | ABSENT — npm ENOENT: no `package.json` at repo root, exit 127 | `evidence/pre/F-2.txt` | 922c5877612f05baba49ec3879f4e110b33da8bf787784cde13026a481276219 |
| F-3 | Example app: `GET /openapi.json` returns a valid 3.1 spec | api | `curl -sv http://localhost:3000/openapi.json` | ABSENT — no server process listening; connection refused, curl exit 7 | `evidence/pre/F-3.txt` | 1410454f78979ff6b089adea3bbf8065f7c08ed0d51f16fdf1d99bc6567a8efd |
| F-4 | Example app: invalid request returns 400 problem+json | api | `curl -sv -X POST http://localhost:3000/example -d '{}'` | ABSENT — no server process listening; connection refused, curl exit 7 | `evidence/pre/F-4.txt` | d47ca3c454c047db0e29e4d4f38dacf6c29e22c5721e011d4a5fcc64d904a433 |
| F-5 | Example app: `GET /docs` renders docs UI (and docs UI via option) | ui | `curl -sv http://localhost:3000/docs` | ABSENT — no server process listening; connection refused, curl exit 7 | `evidence/pre/F-5.txt` | 426a1b22fde90a09a3888189407bad820a930c075f7e858a284648f322fa89a5 |
| F-6 | Example app: a plain (unannotated) route appears in `/openapi.json` via auto-detection | api | `curl -sv http://localhost:3000/openapi.json` | ABSENT — no server process listening; connection refused, curl exit 7 | `evidence/pre/F-6.txt` | 12d9db5a38eeeeb5f7c1165f8706456dfb0c1898c77751ea8b4dc813f8729263 |
| F-7 | Zero-options vs custom-options `createApiDocs()`: endpoints move/disable per config | api | `curl -sv http://localhost:3000/openapi.json` | ABSENT — no server process listening; connection refused, curl exit 7 | `evidence/pre/F-7.txt` | 69d2d2ccc3d7968beab80a0d6604034f3724cb5016d26e28c120d214427d6564 |

## Benches (architecture.md "Bench Commands" / ADR-26 perf gate)

`npm run perf` (`vitest run --config vitest.perf.config.ts`) — **na**, reason: no
`package.json`, no `vitest.perf.config.ts`, no `test/perf/*.perf.test.ts` exist yet on
this branch. `bench-capture.sh` was not invoked because there is no command to wrap;
capturing it would fabricate a run. QA/post stage must run `bench-capture.sh post <id> --
npm run perf` once construction lands the harness, and diff p95 numbers against the
200 ms budget from ADR-26.

## Self-verification

- Every affected flow (F-1..F-7) from prd.md's affected-flows table has one manifest
  row and one evidence file under `evidence/pre/`.
- Each `.txt` file contains the literal command run and its full real output/exit code
  (`npm run build` / `npm pack --dry-run` / `npm test` all exit 127 with npm ENOENT on
  `package.json`; each `curl -sv` exits 7 with "Connection refused").
- No passing output was fabricated anywhere in this manifest or its evidence files.
- Bench row explicitly marked `na` with reason, per role-file convention for absent
  capture targets.
