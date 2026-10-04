# Security & Compliance Report — 2026-09-27-express-openapi-lite

Scope: full Construction diff (`src/**`, 37 files, 2517 insertions, commits `68bbf22..336130e`
plus docs/CI follow-ups `874ebdd..ba553bf`) against `main`. Repo root:
`C:\sai\code practice\Package\API-DOCS`. Node v24.11.1, npm 11.4.2.

## Secrets scan

Tool: gitleaks/trufflehog not installed on this machine (`which gitleaks trufflehog` → not
found). Fallback: regex sweep over all 351 git-tracked files (`git ls-files`), excluding
`.aidd/**` state, for AWS keys, PEM private-key headers, Slack/GitHub/Google tokens, JWTs,
`secret|password|api[_-]?key|token = "..."` assignments, and `mongodb(+srv)?://`/
`postgres(ql)?://` credentialed connection strings.

```
$ git ls-files | xargs -I{} sh -c 'test -f "{}" && echo "{}"' > tracked_files.txt   # 351 files
$ while read -r f; do case "$f" in .aidd/*) continue;; esac; \
    grep -nEI "(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z]+ PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36}|AIza[0-9A-Za-z_-]{35}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(secret|password|passwd|api[_-]?key|token)[[:space:]]*[:=][[:space:]]*['"'"'"][^'"'"'"]{8,}['"'"'"]|mongodb(\+srv)?://[^ ]+:[^ ]+@|postgres(ql)?://[^ ]+:[^ ]+@)" "$f"; \
  done < tracked_files.txt
$ echo $?
1   # no matches
```

**Result: 0 hits.** The `securitySchemes`/`security` OpenAPI options in
`src/config/spec-table.ts` and `src/config/types.ts` are pass-through shape validators
(bearer/apiKey/oauth2 scheme *declarations* for the generated spec) — they hold no
credential material at rest or in code; nothing to redact.

## Dependency audit

Tool: `npm audit` (npm 11.4.2, npm audit report v2), policy per `constitution.md`:
"dependency audit must be clean of CRITICAL"; canonical script is
`npm audit --audit-level=critical`.

```
$ npm audit --audit-level=critical
# npm audit report
esbuild  0.27.3 - 0.28.0
  esbuild allows arbitrary file read when running the dev server on Windows
  GHSA-g7r4-m6w7-qqqr · severity: low · CWE-22 · CVSS 2.5 (AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N)
  fix available via `npm audit fix --force` (breaking: esbuild@0.28.2)
  node_modules/esbuild

qs  2.2.5 - 6.15.3  (nested under node_modules/typed-rest-client/node_modules/qs)
  - DoS via null/undefined entries in comma-format arrays — GHSA-q8mj-m7cp-5q26 · moderate
    · CWE-476 · CVSS 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L)
  - array-limit bypass via bracket-key comma parsing — GHSA-x5fp-wj9c-mxmx · moderate
    · CWE-770 · CVSS 3.7 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L)
  - DoS via attacker-controlled isBuffer — GHSA-4mjr-xmp4-gh2g · moderate
  fix available via `npm audit fix`
  node_modules/typed-rest-client (transitive dev tooling, not a runtime dep)

3 vulnerabilities (1 low, 2 moderate)
$ echo $?
0
```

**Result: PASS against the constitution's audit-level=critical gate** (exit code 0, zero
critical/high findings). `esbuild` and `qs` are transitive **devDependencies only**
(build/test toolchain — `qs` pulled in via `typed-rest-client`, unrelated to the shipped
package); neither ships in `dist/`. `package.json` declares **zero runtime
`dependencies`** — only `devDependencies` and optional `peerDependencies`
(`express`, `@types/express`, `zod`) — so none of these advisories reach a consumer's
`node_modules` via this package. Recommend `npm audit fix` for the moderate `qs` DoS
opportunistically (non-blocking, dev-only).

## OWASP checklist (diff-scoped)

| Area | Checked | Notes |
|---|---|---|
| Injection | PASS | No SQL/shell/eval/`new Function` in `src/**` (`grep -rn "eval(\|new Function\|child_process\|exec(" src` → 0 hits). `src/spec/build.ts` and `src/introspect/**` build a plain-object OpenAPI document from route metadata; no string concatenation into a query/command context. |
| AuthN/AuthZ (N/A for this package, auth-adjacent reviewed) | PASS, info note | The package issues no auth decisions itself — `securitySchemes`/`security` in `src/config/spec-table.ts:101-114` and `src/config/types.ts` are typed pass-throughs that only *declare* bearer/apiKey/oauth2 schemes into the generated OpenAPI JSON for documentation purposes; they never gate route execution or read real credentials. Risk: a caller could unintentionally leak an internal auth topology (e.g., oauth2 flow URLs) into a publicly served `/openapi.json` if `serveSpec` is left `true` (the default) on a non-public API — this is a **usage/config risk**, not a code defect. See threat matrix row T-3. |
| Sensitive data exposure | PASS, 1 info finding | `/openapi.json` and `/docs` are served with **no built-in access control** (`src/serve/router.ts:82-98`, both gated only by boolean `serveSpec`/`serveDocs`, default `true`). This is consistent with the package's purpose (self-serve docs) and is documented default behavior, not a defect, but see T-3 for the exposure risk if mounted on an unauthenticated router in production. No secrets, stack traces, or env vars are embedded in the spec/HTML output (checked `src/spec/build.ts`, `src/docs/render.ts`, `src/route/problem.ts` for leakage of internal paths/error `.stack`). `src/route/problem.ts` (RFC7807 error body) was inspected and only surfaces validation messages, not raw exception stacks. |
| SSRF / deserialization | PASS | `src/docs/cdn.ts` defines three **hardcoded, compile-time constant** CDN URLs (`DOCS_UI_CDN_URL`, `DOCS_UI_UI_JS_CDN_URL`, `DOCS_UI_UI_CSS_CDN_URL`, pinned to specific package versions) — no user or request input reaches this file at all; it is pure string literals. The one runtime-configurable value, `options.cdnUrl` (`src/config/spec-table.ts:45-51`), is a **package-author config option** (set by the developer embedding this library, not derived from any incoming HTTP request/header/query param — confirmed via `src/serve/router.ts:88-97`, which reads `options.cdnUrl` only, never `req.*`) so it is not attacker-reachable through normal request handling; it is still emitted into the docs HTML `<script src>` unescaped-for-scheme (only HTML-entity escaped by `escapeHtml()` in `src/docs/render.ts:14-21,44`, which does not block a `javascript:`/`data:` URI scheme). See threat matrix row T-2 for the residual risk if an application ever binds `cdnUrl` to untrusted input. No `JSON.parse`/deserialization of untrusted payloads found beyond standard `express.json()` body parsing (out of this package's scope) and `req.body`/`req.query` validation via the pluggable `SchemaAdapter` (`src/adapter/**`), which is schema-checked, not `eval`-based. The user-supplied `specUrl` embedded in the docs HTML (`src/docs/render.ts:23-26`) is JSON-encoded then HTML-escaped before being placed in a `data-url`/JS string literal context — correctly mitigates reflected-HTML/script-breakout XSS for that specific sink. |

## SBOM & licenses

Tool: `npx @cyclonedx/cyclonedx-npm` v6.0.1 (CycloneDX JSON, `specVersion` per tool default).

```
$ npx --yes @cyclonedx/cyclonedx-npm --output-file qa/sbom.json --output-format json
(completed; some npm deprecation warnings for prebuild-install/glob transitive tooling — non-blocking)
```

SBOM written to
`.aidd/changes/2026-09-27-express-openapi-lite/qa/sbom.json` (520 components, full
`node_modules` tree including dev/build tooling since the project has no `dependencies`
array to scope against).

License summary (component count by SPDX id, derived from the SBOM):

| License | Count |
|---|---|
| MIT | 436 |
| Apache-2.0 | 29 |
| ISC | 25 |
| MPL-2.0 | 12 |
| BSD-3-Clause | 6 |
| BSD-2-Clause | 6 |
| BlueOak-1.0.0 | 2 |
| 0BSD | 1 |
| MIT,MIT (dual-declared) | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |

**No incompatible (strong copyleft — GPL/AGPL/LGPL) licenses found.** MPL-2.0 (12
components) is weak/file-level copyleft; all 12 are devDependencies (build/test tooling,
e.g. toolchain transitive deps), never bundled into `dist/**` (package `files` field is
`["dist", "LICENSE", "README.md"]`), so no distribution obligation attaches to the
published package. Declared package license: `MIT` (`package.json`), compatible with all
of the above for the package's own shipped code and its `dependencies`/`peerDependencies`
(currently zero and three respectively — `express`, `@types/express`, `zod`, all
MIT/Apache-2.0 family).

## Threat matrix (CWE / CVSS)

| ID | Risk | CWE | CVSS v3.1 vector | Score | Notes |
|---|---|---|---|---|---|
| T-1 | Transitive dev-tooling DoS via vulnerable `qs` (`typed-rest-client`) | CWE-476 / CWE-770 | AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L | 5.3 (moderate) | Dev-only dependency, not shipped in `dist/`; no production exposure. Remediate via `npm audit fix` opportunistically. |
| T-2 | Unsanitized `cdnUrl`/`options.docs.specUrl` scheme could enable `javascript:`/`data:` URI injection into docs HTML `<script src>` if ever bound to untrusted/remote input | CWE-79 (XSS) / CWE-829 (untrusted functionality from untrusted source) | AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N | 6.3 (medium) | Not currently exploitable: `cdnUrl` is developer-set static config (`src/config/spec-table.ts:45-51`), never read from `req.*` (`src/serve/router.ts:88-97`). Residual risk is a future misuse pattern (e.g., an app wiring `cdnUrl` from an admin-configurable DB field). Recommend hardening `escapeHtml`/`renderDocsHtml` to also enforce an `https:`-only scheme allowlist on `cdnUrl` as defence-in-depth; non-blocking for this change. |
| T-3 | `/openapi.json` and `/docs` served with no built-in authN/Z, default `serveSpec`/`serveDocs: true` | CWE-200 (exposure of sensitive information) / CWE-284 (improper access control) | AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N | 5.3 (medium) | By design for a docs-generation library (consistent with intent/AC set); real risk is downstream misconfiguration (mounting on an internal-only API without an upstream auth middleware). Recommend README callout (tracked separately, not a code defect) advising consumers to gate these routes behind their own auth middleware for non-public APIs. |

## Findings

| ID | Severity | Area | Description | Evidence | Recommendation |
|---|---|---|---|---|---|
| SEC-1 | LOW | Dependency audit | Transitive dev-only `qs` (via `typed-rest-client`) has 2 moderate advisories (GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g) | `npm audit` output above | Run `npm audit fix` when convenient; not shipped, not blocking. |
| SEC-2 | LOW | Dependency audit | Direct devDependency `esbuild` 0.27.3-0.28.0 has 1 low advisory (GHSA-g7r4-m6w7-qqqr, Windows dev-server arbitrary file read) | `npm audit` output above | Not applicable to this package's runtime (esbuild dev server not used at runtime); accept or bump via `npm audit fix --force` (breaking) at next maintenance window. |
| SEC-3 | INFO | SSRF/XSS defence-in-depth | `cdnUrl` config value is HTML-escaped but not scheme-validated before insertion into `<script src>` | `src/docs/render.ts:29,44`, `src/config/spec-table.ts:45-51` | Add an `https:`-scheme check (or documented allowlist) to `renderDocsHtml`/`validateOptions` as defence-in-depth; not attacker-reachable today (dev-set config only). |
| SEC-4 | INFO | Data exposure (config/usage) | `serveSpec`/`serveDocs` default to `true` with no built-in auth gate | `src/config/spec-table.ts:52-64`, `src/serve/router.ts:82-98` | Document in README that consumers should apply their own auth middleware ahead of the docs router on non-public APIs (by-design behavior, not a code defect). |

No CRITICAL or HIGH findings; no secrets found; dependency audit is clean of CRITICAL per
the constitution's `--audit-level=critical` gate (exit 0). SEC-1/SEC-2 (LOW, dev-only,
non-shipped) and SEC-3/SEC-4 (INFO, hardening/documentation suggestions) do not block
delivery and do not require adversarial re-verification.
</content>
