# Auditor Verdict — ST-001

Round 1, no challenge issued: independent re-execution of the Builder Report's cited
commands against the actual repo state settled every claimed AC without a named
evidence gap. Rounds used: 1/2.

| AC id | verdict PROVEN\|DISPUTED | evidence cited | note |
|---|---|---|---|
| AC-001 | PROVEN | Read `package.json`: `name: "express-api-docs"`, `license: "MIT"`. Read `LICENSE`: contains "MIT License" and "Copyright (c) 2026 chitha_srinath". `grep -rl "express-openapi-lite" --exclude-dir=.aidd/.git/node_modules/dist/coverage/reports/.stryker-tmp .` → no matches, exit 1. | Independently reproduced, not just the Builder's summary. |
| AC-002 | PROVEN | Ran `npm run build` myself → exit 0, tsup emitted `dist/{index,manual,zod,auto-record}.{js,cjs}` and `dist/{index,manual,zod,auto-record}.d.{ts,cts}`. Read `package.json` `exports['.']` → `import.types/default`, `require.types/default` all map to those emitted files. | Matches AC-002 wording exactly. |
| AC-004 | PROVEN | Read `package.json`: `peerDependencies.express === "^4.21.0 \|\| ^5.0.0"`, `peerDependencies.zod === "^4.2.0"`, `peerDependenciesMeta.zod.optional === true`, `engines.node === ">=22"`, no `dependencies` field (no runtime dep on any UI asset package). `exports['./zod']` present; `dist/index.js` and `dist/index.cjs` inspected directly — no `zod` reference (`grep -i zod dist/index.js dist/index.cjs` → exit 1, no match). Ran `node -e "import('./dist/index.js')"` → resolved, exported 6 symbols, no zod; ran `node -e "require('./dist/index.cjs')"` → same, both succeeded. | zod is present in node_modules as a devDependency but the main entry never touches it — the "without zod installed" claim is proven by the entry's static independence from zod (no import, confirmed by source inspection and successful load), not by physically uninstalling zod. This is the same evidence class the Builder cited; deemed sufficient because `dist/index.{js,cjs}` demonstrably contain zero zod references. |
| AC-020 | PROVEN | Ran `npm pack --dry-run --json` myself → file list ends at `dist/*`, `LICENSE`, `README.md`, `package.json`; no `.css` files, no `single-value`/`docs-ui`/`redoc` paths, `bundled: []`. | Independently reproduced. |
| AC-025 | PROVEN | Ran `npm test` myself → "Test Files 10 passed (10)", "Tests 52 passed (52)", coverage summary: Statements 100% (6/6), Branches 100% (0/0), Functions 100% (0/0), Lines 100% (6/6) — all ≥90%. | Coverage denominators are small (only `src/core/types.ts` has statements at this wave) but AC-025 as written only demands the thresholds be met, which they are. |
| AC-026 | PROVEN | Ran `npm run lint` myself → `eslint . && prettier --check .`, "All matched files use Prettier code style!", exit 0. Ran `npx tsc --noEmit` myself → no output, exit 0. | Independently reproduced. |
| AC-027 | PROVEN | Read `.github/workflows/ci.yml` directly: `on: push` (all branches) and `pull_request`; matrix `node: [22, 24]` × `express: [4, 5]`; every cell runs `npm run build`, `npm run lint`, and a typecheck (`npm test` + `npx tsc --noEmit` for express 5, `npm run test:v4` for express 4, which internally runs `typecheck:v4`). | Matches AC-027's amended wording (typecheck in every cell, v4 via `test:v4`). |
| AC-028 | PROVEN | Read `.github/workflows/release.yml` directly: `on:` block is exactly `workflow_dispatch`; steps are `checkout`, `github-script` (checks last mutation-full conclusion), `npm ci`, `npm run build`, `npm run check:pack` — no `npm publish` step anywhere in the file. Read `ci.yml` and `mutation-full.yml` — neither contains `npm publish`, and mutation-full's `on:` is exactly `schedule`+`workflow_dispatch`. No `npm publish` was executed during this audit. | Independently reproduced. |

## Summary

All 8 claimed ACs (AC-001, AC-002, AC-004, AC-020, AC-025, AC-026, AC-027, AC-028)
settled PROVEN in round 1 via direct re-execution/re-reading of the underlying repo
artifacts (package.json, LICENSE, dist/ build output, npm pack --dry-run --json,
npm test, npm run lint, npx tsc --noEmit, .github/workflows/*.yml) — not by trusting
the Builder Report's prose. No AC required a challenge round. Nothing routes to
negotiation.
