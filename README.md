# express-api-docs

Zero-config OpenAPI 3.1 documentation for Express 4 and 5. Typed routes validate
requests (and optionally responses) against your schemas; every route you
write, `describe()`, or leave plain gets picked up automatically and turned
into a spec served at `/openapi.json`, with a docs UI at `/docs`.

## Install

```sh
npm install express-api-docs
```

Peer requirements: `express` `^4.21.0 || ^5.0.0`. Node.js **>= 22**.

`zod` is an **optional peer** (`^4.2.0`) — only needed if you use Zod schemas
with the `express-api-docs/zod` adapter. Requires zod >= 4.2. The core
(`express-api-docs`) never imports `zod`; zero-options `createApiDocs()`
already accepts Zod v4 schemas out of the box via the built-in
`standardSchemaAdapter` (any [Standard Schema](https://standardschema.dev)
library works the same way).

**Import order matters:** `express-api-docs` must be imported before you
create or mount any router. On import, it patches Express's Router/Layer
prototypes so it can recover mount prefixes for routes registered anywhere in
your app tree:

```ts
import { createApiDocs } from 'express-api-docs'; // import before mounting routers
import express from 'express';

const app = express();
```

On Express 4, mounts made before the import still recover their prefix via a
`layer.regexp` fallback. On Express 5, mounts made before the import fall back
to the router's local path only, and a `warn` is emitted.

## Quick start

```ts
import { createApiDocs } from 'express-api-docs'; // import before mounting routers
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

const apiDocs = createApiDocs();
const { route } = apiDocs;

app.post(
  '/widgets',
  ...route(
    'post',
    '/widgets',
    { body: z.object({ name: z.string() }), response: z.object({ id: z.string(), name: z.string() }) },
    (req, res) => {
      res.status(201).json({ id: '1', name: req.body.name });
    },
  ),
);

app.use(apiDocs.router);
app.listen(3000);
// GET /openapi.json -> the generated OpenAPI 3.1 document
// GET /docs          -> a Scalar docs UI
```

See `examples/basic` for a complete, runnable version of this example.

## SchemaAdapter

`createApiDocs` resolves a `SchemaAdapter` per route in this order:

```
meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter
```

- `meta.adapter` — a per-route override passed to `route()`'s `meta` argument.
- `options.schemaAdapter` — a global option (`OPTION_SPEC` row, default
  `null`, meaning "use the core default `standardSchemaAdapter`").
- `standardSchemaAdapter` — the core's zero-config default. It accepts any
  schema library implementing the [Standard Schema](https://standardschema.dev)
  spec, including Zod v4, Valibot and ArkType.

A `SchemaAdapter` is duck-typed: an object with three function members:

| Member | Signature | Purpose |
| --- | --- | --- |
| `isSchema` | `(value: unknown) => boolean` | Identifies whether a value is a schema this adapter understands. |
| `validate` | `(schema, input) => ValidationResult` | Synchronously validates `input` against `schema`. |
| `toJSONSchema` | `(schema, io: 'input' \| 'output') => JSONSchema` | Converts `schema` to a plain JSON Schema for the generated OpenAPI document. |

Only `standardSchemaAdapter` and `zodAdapter` (see below) are shipped, but you
can write your own adapter and pass it as `meta.adapter` or
`options.schemaAdapter`.

### The `express-api-docs/zod` subpath

`zodAdapter`, from `express-api-docs/zod`, is a Zod-specific adapter with two
advantages over the generic `standardSchemaAdapter`:

- typed `z.infer` end to end;
- `unrepresentable: 'any'` when converting to JSON Schema, so transforms and
  custom types degrade to `{}` instead of throwing.

```ts
import { zodAdapter } from 'express-api-docs/zod';

const apiDocs = createApiDocs({ schemaAdapter: zodAdapter });
```

`zod` is an **optional peer**, `^4.2.0`. Requires zod >= 4.2 — the `./zod`
subpath has the same floor as the core's peer range. `zodAdapter` is only
exported from the `express-api-docs/zod` subpath; the main entry does not
export it.

## Security

- `securitySchemes` and `security` (global) and per-route `meta.security`
  (via `OperationMeta`) map directly onto the OpenAPI `securitySchemes` and
  `security` keywords — express-api-docs does not enforce authentication or
  authorization itself, it only documents the shapes you declare.
- The recorder patches Express's Router/Layer *prototypes*, not your request
  pipeline; it has no runtime effect on how requests are routed or answered.
- Response validation is disabled by default (see below) so introducing
  express-api-docs into an existing service cannot change response bodies
  unless you opt in.

## Docs UI

`GET /docs` (configurable via `docsPath`) serves an interactive documentation
UI that reads the generated spec from `GET /openapi.json` (configurable via
`specPath`, or overridden per-UI via `docs.specUrl`).

- `ui: 'scalar'` (default) — a [Scalar](https://scalar.com) UI.
- `ui: 'swagger-ui'` — a Swagger UI, for teams standardized on it.
- `cdnUrl` overrides the CDN the UI assets are loaded from (useful offline or
  behind a strict CSP).

## Response validation

Typed routes (`route()`) can optionally validate the JSON body a handler
sends, against the route's `response` schema:

- `validateResponses: false` (default) — responses are never validated;
  `res.json`/`res.send` are not wrapped at all (an identity no-op).
- `validateResponses: 'warn'` — a mismatch is logged (`debug`/`warn`) but the
  response is still sent unchanged.
- `validateResponses: 'error'` — a mismatch replaces the response with a
  problem+json error instead of the mismatched body.

**Limitation (R-6):** only `res.json(...)` and `res.send(<object>)` calls are
covered. Raw strings, buffers and streams sent via `res.send`/`res.write` are
never validated.

**Limitation (R-7):** JSON Schema conversion for adapters that support
`unrepresentable: 'any'` (e.g. `zodAdapter`) emits `{}` for transforms and
other custom types it cannot represent — this makes the generated schema
lossy by design for those constructs.

## Error shape

Two branded error classes are exported from both `.` and `./manual`:

- `ApiDocsConfigError` — thrown synchronously when `createApiDocs(options)` is
  given invalid options, before anything is built.
- `ApiDocsSchemaError` — thrown when a route's schema adapter returns a
  Promise from `validate()` (async schema validation is not supported); code
  `EAD_ASYNC_SCHEMA`.

The most portable way to match an error is its stable `code` property:

```ts
try {
  createApiDocs(options);
} catch (err) {
  if (err.code === 'EAD_ASYNC_SCHEMA') {
    // ...
  }
}
```

You can also use `instanceof ApiDocsConfigError` / `instanceof ApiDocsSchemaError`.
Unlike a naive `constructor.name` or brand-on-`name` comparison, these
`instanceof` checks work across ESM/CJS copies of the package, across separate
bundles, and under minification (mangled class names) — including for your
own subclasses of these error classes. Do not match on `err.name` or
`err.constructor.name`, which are not stable once code is minified.

Request-validation failures (typed routes only) are sent to the client as
`application/problem+json` with a `400` status (RFC 9457 shape:
`type`/`title`/`status`/`detail`/`errors`), not thrown as JS errors.

## Incremental adoption

You can adopt express-api-docs one route at a time:

- **Typed routes** — `route('get', '/x', meta, handler)` validates requests
  (and optionally responses) and documents the route from `meta`.
- **`describe()`** — `apiDocs.describe('get', '/x', meta)` returns a
  pass-through middleware that documents a route without adding any
  validation; useful for existing plain routes you only want to annotate.
- **Auto-detection** — routes that are neither `route()`-wrapped nor
  `describe()`-tagged are still discovered by walking the Express router tree
  (see below), so an app can ship a spec on day one with zero code changes,
  then be upgraded route by route.

## Route auto-detection

By default (`autoDetect: true`), express-api-docs walks the Express app's
router tree at spec-build time and documents every route it finds that was
not already registered via `route()`/`describe()`, inferring path parameters
from the Express path syntax (`:id`, `{id}`) and RegExp/wildcard segments
where possible.

- `autoDetect: false` disables detection entirely — only `route()`/`describe()`
  routes appear in the spec.
- `autoDetect: { include?: string[], exclude?: string[] }` scopes detection to
  matching globs; `express-api-docs`'s own `specPath`/`docsPath` routes are
  always excluded.
- `detectedDefaultResponse` overrides the synthesized default response for
  auto-detected operations.

### `installRecorder` and second copies of Express

Importing `express-api-docs` (or `express-api-docs/manual` plus a call to
`installRecorder()`) patches the Router/Layer prototypes of **one** resolved
copy of Express. If your app has a second copy of Express — a common outcome
of pnpm's strict node_modules layout, certain monorepo setups, or a bundler
that inlines Express into a dependency — that second copy is never patched by
the automatic import.

Call `installRecorder(require('express'))` (or the ESM equivalent) yourself,
passing your own copy of Express, to patch it too:

```ts
import { installRecorder } from 'express-api-docs/manual';
import express from 'express'; // a second copy, e.g. inside a workspace package

installRecorder(express);
```

If a router's owner prototype is never patched, the first spec build emits
exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`, naming the fix
(`installRecorder(<your express>)`). Sub-apps mounted on an unpatched copy
have no way to be linked back to the parent app; their routes are dropped from
the spec, with one `warn` `EAD_SUBAPP_UNRECORDED` per mount.

### `express-api-docs/manual` (opt-out entry)

`express-api-docs/manual` re-exports the identical public API as the main
entry, **without** patching Express on import. Use it when you need control
over exactly when (or whether) the recorder installs — hot-reload workflows,
tests that create many app instances, or setups sensitive to APM
instrumentation order:

```ts
import { createApiDocs, installRecorder } from 'express-api-docs/manual';
import express from 'express';

installRecorder(express); // install explicitly, at a time you choose
```

### APM instrumentation order

Some APM agents wrap `express.Router`'s `use` method to add their own
instrumentation. `test/introspect/apm-order.test.ts` applies a third-party
-style `use` wrapper both **before** and **after** `installRecorder()` runs,
and asserts mount-prefix recovery still works in both orders. Observed result:
in both orders, a transparent passthrough wrapper (one that forwards `this`
and all arguments unchanged, the common shape for tracing wrappers) preserved
mount prefixes correctly; neither order triggered the fallback warn in this
scenario. A wrapper that replaces `this` or drops arguments could still defeat
prefix recovery — in that case the recorder never fails silently, it degrades
to one `warn` `EAD_LAYER_UNRECOGNISED` per affected layer.

## Configuration

`createApiDocs(options?)` accepts a partial `ApiDocsOptions` object; every key
is optional and merges over `DEFAULT_OPTIONS` (a public export of `.`).

| key | default | description |
| --- | --- | --- |
| `specPath` | `/openapi.json` | the path the generated OpenAPI document is served from |
| `docsPath` | `/docs` | the path the docs UI is served from |
| `ui` | `scalar` | which docs UI to render |
| `cdnUrl` | `undefined` | a CDN URL override for the docs UI assets |
| `serveSpec` | `true` | whether the spec endpoint is mounted |
| `serveDocs` | `true` | whether the docs UI endpoint is mounted |
| `docs.specUrl` | `undefined` | an explicit spec URL for the docs UI to fetch |
| `openapi.info` | `undefined` | OpenAPI info overrides (default: `{ title: 'API', version: '0.0.0' }`) |
| `openapi.servers` | `undefined` | OpenAPI servers list |
| `openapi.tags` | `undefined` | OpenAPI tag definitions |
| `securitySchemes` | `undefined` | OpenAPI securitySchemes map |
| `security` | `undefined` | global OpenAPI security requirement |
| `validateRequests` | `true` | whether typed routes validate requests |
| `validateResponses` | `false` | whether/how typed routes validate responses (`false`, `'warn'` or `'error'`) |
| `onValidationError` | `undefined` | a formatter invoked when request validation fails |
| `autoDetect` | `true` | plain-route auto-detection (a boolean or `{ include?, exclude? }`) |
| `detectedDefaultResponse` | `undefined` | the default response synthesized for auto-detected operations |
| `operationIdStrategy` | `undefined` | a custom `operationId` generator |
| `tagStrategy` | `undefined` | a custom tag generator |
| `schemaAdapter` | `null` | the global schema adapter (`null` means the core default `standardSchemaAdapter`) |

The default `info` is the static `{ title: 'API', version: '0.0.0' }` when
`openapi.info` is not given.

## Internals

express-api-docs coordinates across module copies (recorder installed by
`.`/`./manual`, walked by whichever copy builds the spec) using a small set of
`Symbol.for` keys, all **protocol-versioned**: `express-api-docs.v1.meta`,
`express-api-docs.v1.mount`, `express-api-docs.v1.child`,
`express-api-docs.v1.recorder`, `express-api-docs.v1.brand` and
`express-api-docs.v1.brandKey`. The brand and brand-key keys back the
cross-build/minification-safe `instanceof` mechanism (ADR-49) used by
`ApiDocsConfigError` and `ApiDocsSchemaError`. The value stored under the recorder key is
`{ protocol: 1, packageVersion }`. A walker only ever reads keys for its own
protocol version; a newer protocol number can coexist with (and safely ignore)
an older one, and the same protocol number is always reused across a
compatible release range. Any future change to a payload's shape bumps the
protocol number — this note is the changelog for that number.

## Contributing / Development

```sh
npm install
npm run build          # tsup — builds dist/
npm test               # vitest run --coverage --typecheck (90% floor: lines/branches/functions/statements)
npm run lint           # eslint . && prettier --check .
npx tsc --noEmit       # typecheck
npm run check:pack     # npm run build && publint && attw --pack .
npm run perf           # vitest run --config vitest.perf.config.ts
npm audit              # npm audit --audit-level=critical
```

Contributors and CI need **Node.js >= 22.19**; the published package's
`engines.node` field is `>=22`. CI runs the matrix Node {22, 24} x Express
{4, 5}.

### Mutation testing

Two different mutation runs exist:

- **Scoped** (per story, and the PR CI job `mutation-scoped`): only the
  `src/**` globs touched by the change, incrementally:

  ```sh
  npx stryker run --mutate "<src globs>" --incremental
  ```

  Break threshold: **70** on that scope.

- **Nightly full** (`npm run mutation`, CI job `mutation-full`, triggered by
  `schedule` nightly and `workflow_dispatch` only): the entire `src/**` tree.
  A red nightly run blocks the next release.

## Examples

`examples/basic` is a complete, runnable Express app using
`express-api-docs`, exercised by `test/docs/example-smoke.test.ts`:

```sh
npx tsx examples/basic/server.ts
```
