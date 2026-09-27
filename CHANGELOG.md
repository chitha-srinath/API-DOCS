# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-27

### Added

- `createApiDocs(options)`: one typed, validated configuration object with documented
  defaults (`DEFAULT_OPTIONS`) and `ApiDocsConfigError` for invalid options.
- Typed route helper `api.route()` with request validation (params, query, headers, body),
  coerced values, inferred handler types and RFC 9457 problem+json errors.
- Optional response validation (`validateResponses: 'warn' | 'error'`).
- OpenAPI 3.1 spec endpoint (`/openapi.json`) and docs UI (`/docs`, Scalar or Swagger UI from a
  version-pinned CDN).
- Security schemes (bearer, apiKey, oauth2, openIdConnect, mutualTLS) declared once, with
  global and per-route requirements.
- Auto-detection of plain Express 4 and 5 routes, including nested routers and sub-apps,
  with `include`/`exclude` globs; `api.describe()` for docs-only metadata.
- Pluggable `SchemaAdapter`: Standard Schema default, Zod 4 adapter at `express-api-docs/zod`.
- `installRecorder()` and the `express-api-docs/manual` entry for explicit mount recording.
- Dual ESM/CJS build with type declarations.
