# Intent — 2026-09-27-express-openapi-lite

## Verbatim intent

> Build express-openapi-lite (working name): a TypeScript-first npm package that generates OpenAPI 3.1 docs for Express from route definitions with near-zero config. Zod schemas go through a pluggable SchemaAdapter interface (Zod adapter ships first; other schema libraries additive later without breaking changes). Required: typed route helper that validates requests and infers handler types; automatic path/query/body/response/params docs; security schemes (bearer, apiKey, oauth2) declared once; a docs UI endpoint (Scalar or Swagger UI via CDN, no bundled assets); a JSON spec endpoint; incremental adoption on existing routers; ESM+CJS dual build with .d.ts; tests with >=90% coverage; README, examples, CHANGELOG, CI, and npm publish config.

> Note: per Q1 the package name is **`express-api-docs`**. The working name "express-openapi-lite" is kept only in the quote above (verbatim) and in the change id.

## Clarifying questions

<!-- Mode: let-me-look. Rigor: critical. Inputs: snapshot.md (empty tree, greenfield), constitution.md (TS, Node v24, vitest, 90% coverage, GitHub Actions), learnings.md (no entries). -->

| # | Question | Why it matters | Answer / default | Source | BLOCKING? |
|---|---|---|---|---|---|
| Q0a | Greenfield build or extend existing code? | Sets scaffolding scope | Greenfield in this repo | human | no — resolved |
| Q0b | Which schema library first, and how is it extended? | Core API shape | Zod first, behind a pluggable `SchemaAdapter`; other libraries added later without breaking changes | human | no — resolved |
| Q1 | Final npm package name? | Publishing is public and irreversible | `express-api-docs` (unscoped). Working name renamed everywhere. | human | resolved |
| Q2 | Should CI publish to npm? | External credential; irreversible external write | No auto-publish. CI builds and tests; the release workflow is manual-dispatch only; nothing is published in this run. | human | resolved |
| Q3 | Zod v3, v4, or both? | Drives the adapter implementation and the peer range | Zod v4 only (`zod@^4` peer), using native `z.toJSONSchema` | human (approved default) | resolved |
| Q4 | Express 4, Express 5, or both? | Path syntax and async error forwarding differ | Both (`express@^4.21 \|\| ^5`), tested in a CI matrix | human (approved default) | resolved |
| Q5 | Minimum Node and TypeScript versions? | `engines`, build target, CI matrix | Node >=20 (CI runs 20, 22, 24); TypeScript >=5.4 with `strict`. SUPERSEDED at pre-review: Node >=22 (see Revisions). | human (approved default) | resolved |
| Q6 | Default docs UI? | Default UX, CDN, CSP | Scalar by default, Swagger UI selectable; version-pinned CDN URL that can be overridden | human (approved default) | resolved |
| Q7 | Response validation mode? | Runtime cost; divergent outcomes | Off by default; `validateResponses: false \| 'warn' \| 'error'` (`'warn'` logs, `'error'` returns 500) | human | resolved |
| Q8 | Error shape for request validation failures? | Public API contract | 400 with an RFC 9457 `application/problem+json` body (`type`, `title`, `status`, `detail`, `errors[{in,path,message}]`); custom `onValidationError` hook; the 400 is added to the spec automatically | human | resolved |
| Q9 | How are existing plain routes adopted incrementally? | Scope of incremental adoption | REVISED at G1 (see below). The typed helper mounts on any `Router`; `describe()` documents plain handlers (docs only); plain routes with neither are **auto-detected** by walking the Express router stack. | human (G1 revise) | resolved |
| Q10 | License? | Legal choice, irreversible after publication | MIT, copyright chitha_srinath | human | resolved |

Open BLOCKING: 0. Open non-blocking: 0.

## Revisions

- **G1 revise #1 (Source: human):** "auto detecting express routes should be in scope".
  - Q9's "no automatic introspection" is reversed.
  - In `prd.md`, auto-detection is removed from Out-of-Scope and AC-023 is replaced. New ACs AC-030 to AC-034 cover the opt-out, precedence, lazy detection, self-exclusion, and regex/wildcard handling. AC-029 now also requires the README to document auto-detection.
- **G1 revise #2 (Source: human):** "everything should be configured by the user as well, the package should have some default configuration where user can also override it according to his project".
  - New ACs AC-035 to AC-046 cover:
    - a single typed `createApiDocs(options)` config object;
    - a setup that works with zero options;
    - an exported `DEFAULT_OPTIONS` plus a README defaults table;
    - overrides for every behavior;
    - precedence: per-route over global over default, as a deep merge in which arrays are replaced;
    - fail-fast validation of the config.
- **AC-043 testability fix (coordinator-approved):** the ambiguous "rejected at setup, or also disabled" clause is replaced by the single rule in A-9.
- **Pre-review amendment #1 (Source: human, approved Node floor):** Node 20 is dropped because it reached EOL in April 2026 and the pinned test tooling (vitest 5, Stryker 10) needs Node 22 or newer. This supersedes Q5's Node default.
  - AC-004: `engines.node` is `>=22`.
  - AC-027: CI runs on Node 22 and 24, against Express 4 and 5.
- **Pre-review amendment #2 (pre-review finding PF-2, Source: coordinator):** users of other schema libraries must be able to import the package without zod installed.
  - AC-004: `zod` is an optional peer (`peerDependenciesMeta.zod.optional: true`), and the Zod adapter is exported only from the subpath `express-api-docs/zod`, not from the main entry.
- Neither G1 revision raises a BLOCKING question: all details are reversible and non-destructive, and none needs credentials. The defaults are recorded below as assumptions for the human to confirm at G1.

## Assumptions (G1 revisions — flagged for confirmation at G1)

| # | Assumption | Confidence | Evidence / rationale |
|---|---|---|---|
| A-1 | Auto-detection is **on by default** (`autoDetect: true`). It is turned off with `autoDetect: false`. `exclude` is a list of path glob strings (e.g. `/internal/**`) matched against the resulting OpenAPI path. | M | The human said "should be in scope", and the intent says "near-zero config", so this is opt-out. |
| A-2 | Regex paths (`RegExp` routes) and Express 4 unnamed `*` wildcards are **skipped**, with one debug log line naming the route. Express 5 named wildcards (`/*name`) map to `{name}`. Optional segments (`:id?` in Express 4, `{/:id}` in Express 5) produce two paths, one without and one with the segment. | M | The human's note allows mapping or skipping as long as it is deterministic. This picks the simplest deterministic rule. |
| A-3 | The default auto-detected `operationId` is `<method><PascalCasedPathSegments>`, with params written as `By<Param>` (e.g. `GET /users/:id` becomes `getUsersById`). A collision gets a numeric suffix in registration order. It can be overridden through the `operationId` strategy option. | M | It is stable and deterministic, and the format is not specified anywhere else. |
| A-4 | The default tag is the first static path segment after the mount prefix is resolved; the root path `/` gets `default`. It can be overridden through the `tag` strategy option. | M | Follows the human's rule "tag from first path segment". |
| A-5 | Detection runs lazily at the first spec request and the result is cached. The cache is keyed on the router-stack length, so a changed stack length triggers a re-walk. | M | The human asked for lazy detection. A length key is cheap and deterministic. |
| A-6 | The option names are `specPath` (default `/openapi.json`), `docsPath` (`/docs`), `serveSpec` (true), `serveDocs` (true), `ui` (`'scalar'`), `cdnUrl` (a pinned default per UI), `openapi.info` (title and version from the consumer's `package.json` when readable, otherwise `API` / `0.0.0`), `openapi.servers` (`[]`), `openapi.tags` (`[]`), `securitySchemes` (`{}`), `security` (global default `[]`), `validateRequests` (true), `validateResponses` (false), `onValidationError` (the RFC 9457 formatter), `autoDetect` (true), `include` (`['/**']`), `exclude` (`[]`), `detectedDefaultResponse` (generic 200), `operationIdStrategy` (A-3), `tagStrategy` (A-4). The architect may rename these; the ACs bind to the behavior and to the `DEFAULT_OPTIONS` export. | M | The human asked for everything to be configurable with defaults. These names are self-descriptive. |
| A-7 | Request validation is **on** by default for typed routes (`validateRequests: true`). | H | The intent says the typed helper "validates requests". |
| A-8 | Config errors throw synchronously from `createApiDocs()` as an exported `ApiDocsConfigError` whose message names the option path and the expected value. Config objects are validated with an internal schema. | M | The human asked for "fail fast at setup with a clear error". |
| A-9 | `serveSpec: false` combined with `serveDocs: true` throws `ApiDocsConfigError` at setup, **unless** `docs.specUrl` is set explicitly. In that case the docs page points at that (e.g. externally hosted) spec URL. `docs.specUrl` defaults to unset, meaning the docs page uses `specPath`. | M | This removes the ambiguity in AC-043 with a single deterministic outcome; approved by the coordinator. |
