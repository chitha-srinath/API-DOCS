# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-09-28

Initial release.

### Added

- `createApiDocs(options?)` — zero-config OpenAPI 3.1 document generation and
  a `/docs` UI (Scalar by default, Swagger UI opt-in) for Express 4 and 5.
- Typed routes via `route(method, localPath, meta, handler)`: request
  validation (`validateRequests`) and optional response validation
  (`validateResponses: 'warn' | 'error'`) against a `SchemaAdapter`.
- `describe(method, localPath, meta)` (via `apiDocs.describe`) to annotate an
  existing plain route without adding validation.
- Route auto-detection (`autoDetect`, default on, with `include`/`exclude`
  globs or `autoDetect: false` to opt out) so unannotated routes still appear
  in the generated spec.
- `standardSchemaAdapter` (the core default, works with any
  [Standard Schema](https://standardschema.dev) library) and the global
  `schemaAdapter` option / per-route `meta.adapter` resolution order.
- `express-api-docs/zod` subpath export: `zodAdapter`, for typed `z.infer` and
  `unrepresentable: 'any'` JSON Schema conversion. `zod` is an **optional
  peer**, `^4.2.0` (Node >= 22).
- `express-api-docs/manual` subpath export: the identical public API without
  the import-time Express patch, for callers who need to control exactly when
  `installRecorder()` runs.
- `installRecorder(express)` for patching a second copy of Express (pnpm,
  monorepos, bundlers that inline Express); a `warn` (`EAD_RECORDER_NOT_INSTALLED`)
  is emitted once if no copy was ever patched.
- Branded errors `ApiDocsConfigError` and `ApiDocsSchemaError`, exported from
  `.` and `./manual`, matched by `err.code` or `instanceof` (safe across
  builds, bundles and minification).
- `DEFAULT_OPTIONS`, a public export of `.`, driven by the same `OPTION_SPEC`
  table that powers runtime option validation and the README defaults table.
- `examples/basic`, a runnable example app covered by an automated smoke test.
- Node.js **>= 22** required (CI matrix: Node {22, 24} x Express {4, 5}).

[0.1.0]: https://github.com/example/express-api-docs/releases/tag/v0.1.0
