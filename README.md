# express-api-docs

TypeScript-first **OpenAPI 3.1** docs and **request validation** for Express 4 and 5, with
near-zero config. Define a route once with schemas and get:

- validated, coerced `req.params` / `req.query` / `req.body` with inferred types;
- an OpenAPI 3.1 JSON endpoint (`/openapi.json`) and a docs UI (`/docs`, Scalar or Swagger UI from a pinned CDN);
- RFC 9457 `application/problem+json` errors for invalid requests;
- automatic documentation of your existing plain Express routes.

Schemas go through a pluggable `SchemaAdapter`. The built-in default speaks
[Standard Schema](https://standardschema.dev), so Zod 4 (and Valibot, ArkType, ...) work
out of the box; a dedicated Zod adapter ships at `express-api-docs/zod`.

## Install

```sh
npm install express-api-docs express zod
```

Requires Node.js >= 22 and Express `^4.21.0 || ^5.0.0`. `zod` (`^4.0.0`) is an optional peer
dependency: install it only if you use Zod. TypeScript users also want `@types/express`.
The package ships ESM and CommonJS builds with type declarations.

## Quick start

```ts
import { createApiDocs } from 'express-api-docs'; // import before creating routers
import express from 'express';
import { z } from 'zod';

const api = createApiDocs();
const app = express();
app.use(express.json());
app.use(api.router); // GET /openapi.json and GET /docs

const router = express.Router();
router.get(
  '/users/:id',
  ...api.route(
    {
      summary: 'Get a user',
      params: z.object({ id: z.coerce.number().int() }),
      query: z.object({ expand: z.enum(['posts']).optional() }),
      responses: { 200: z.object({ id: z.number(), name: z.string() }) },
    },
    (req, res) => {
      req.params.id; // number
      res.json({ id: req.params.id, name: 'Ada' }); // type-checked against the 200 schema
    },
  ),
);
app.use('/api', router);

app.listen(3000); // open http://localhost:3000/docs
```

`api.route(definition, handler)` returns `[validator, handler]`; spread it into any
Express route method. Async handlers are supported: a thrown error or rejected promise
reaches your error middleware exactly once, on Express 4 and 5.

A runnable example lives in [`examples/basic`](examples/basic).

## Route definitions

| Key                                                                       | Meaning                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `params`, `query`, `headers`, `body`                                      | Request schemas. Validated (unless `validateRequests: false`); parsed values replace `req.params`, `req.query` and `req.body`. |
| `responses`                                                               | `{ [status]: schema }` or `{ [status]: { description, schema?, contentType? } }`; `default` is allowed.                        |
| `summary`, `description`, `operationId`, `tags`, `deprecated`, `security` | Operation documentation.                                                                                                       |
| `bodyContentType`                                                         | Request body media type (default `application/json`).                                                                          |
| `method`, `path`                                                          | Optional. Only needed for `api.getSpec()` before the app was walked; the router stack is the source of truth.                  |
| `validateRequests`, `validateResponses`, `onValidationError`              | Per-route overrides of the global options.                                                                                     |

## Error shape

An invalid request never reaches the handler. The client receives `400` with
`Content-Type: application/problem+json` ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)):

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed with 1 issue.",
  "errors": [
    {
      "in": "body",
      "path": "name",
      "message": "Invalid input: expected string, received undefined"
    }
  ]
}
```

`errors[].in` is `path`, `query`, `header` or `body`; `path` is the dotted path inside it.
Every typed operation with a request schema documents this `400` response with a
`$ref` to `#/components/schemas/ProblemDetails`.

To change the response, set `onValidationError` globally or per route:

```ts
createApiDocs({
  onValidationError: (issues, req) => ({ status: 422, body: { message: 'Invalid', issues } }),
});
```

## Response validation

Off by default. With `validateResponses: 'warn'` an invalid body is still sent and exactly
one warning is logged through the configured logger. With `'error'` the client gets a
`500` problem+json and the invalid body is not sent. The schema is picked by status code
(falling back to `default`). `res.json()` and `res.send(object)` are validated; raw strings,
buffers and streams are not. When the option is off, `res.json` is not wrapped at all.

## Security

Declare schemes once and reference them by name:

```ts
const api = createApiDocs({
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
    oauth: {
      type: 'oauth2',
      flows: {
        clientCredentials: { tokenUrl: 'https://auth.example.com/token', scopes: { read: 'Read' } },
      },
    },
  },
  security: [{ bearer: [] }], // inherited by every operation without its own
});

router.get('/public', ...api.route({ security: [] }, handler)); // explicitly public
router.get('/keyed', ...api.route({ security: [{ apiKey: [] }] }, handler));
```

Security is documentation only: enforce authentication with your own middleware.

## Docs UI

`GET /docs` serves an HTML page that loads **Scalar** (`@scalar/api-reference@1.72.1`) from
jsDelivr and points it at the spec endpoint. Set `ui: 'swagger-ui'` for Swagger UI
(`swagger-ui-dist@5.33.0`). No UI assets are bundled in the package. `cdnUrl` overrides the
pinned URL: for Scalar it is the script URL, for Swagger UI the base URL that contains
`swagger-ui-bundle.js` and `swagger-ui.css`. The spec URL is relative to where
`api.router` is mounted, or `docs.specUrl` when set.

## SchemaAdapter

Any validation library can be used by implementing the `SchemaAdapter` port:

```ts
import type { SchemaAdapter } from 'express-api-docs';

const myAdapter: SchemaAdapter<MySchema> = {
  name: 'my-lib',
  isSchema: (value): value is MySchema => value instanceof MySchema,
  validate: (schema, input) => {
    const result = schema.check(input); // must be synchronous
    return result.ok
      ? { ok: true, data: result.value }
      : { ok: false, issues: result.errors.map((e) => ({ path: e.path, message: e.message })) };
  },
  toJSONSchema: (schema, io) => schema.toJsonSchema(io), // JSON Schema draft 2020-12
};

createApiDocs({ adapter: myAdapter });
```

- **Default:** `standardSchemaAdapter` uses `schema['~standard'].validate` and
  `schema['~standard'].jsonSchema`. The package never imports `zod` itself.
- **Zod:** `import { zodAdapter } from 'express-api-docs/zod'` uses `safeParse` and
  `z.toJSONSchema(..., { unrepresentable: 'any' })`: types JSON Schema cannot represent
  (transforms, dates, custom) are documented as `{}`.
- Schemas must validate synchronously. An async refinement makes the request fail with
  `ApiDocsSchemaError` (code `EAD_ASYNC_SCHEMA`) passed to `next(err)`, so the client gets a 500.
- A Standard Schema without a JSON Schema converter is documented as `{}` with one
  `EAD_SCHEMA_NO_JSONSCHEMA` warning.
- Recursive schemas that produce `$defs`/`$ref` are not hoisted into `components` yet.

## Incremental adoption

Typed routes are ordinary Express handlers, so you can add them one at a time to an
existing app or `Router`. Plain routes keep working exactly as before and are never
validated. To document a plain route without validating it, add `api.describe()`:

```ts
router.post(
  '/legacy',
  api.describe({
    summary: 'Legacy import',
    body: LegacySchema,
    responses: { 202: { description: 'Queued' } },
  }),
  legacyHandler,
);
```

## Route auto-detection

Plain routes registered with `app.get()`, `router.post()`, `app.route()` and so on are
documented automatically: the spec endpoint walks the app's router stack on the first
request (via `req.app`) and re-walks when the stack changes (`api.invalidate()` forces it).
Each detected operation gets an `operationId` (`GET /users/:id` → `getUsersById`), the
first static path segment as its tag, string path parameters, and
`detectedDefaultResponse` (`200 OK`). Request and response schemas are not inferred.

- `:id` becomes `{id}`; Express 5 named wildcards `/*rest` become `{rest}`; optional
  segments (`:id?` on Express 4, `{/:id}` on Express 5) produce two paths.
- RegExp routes and unnamed wildcards (`*`) are skipped with one `debug` log line each.
- A typed or `describe()` route wins over a plain route with the same method and path.
- The package's own spec and docs endpoints are never documented.

**Opting out:** `autoDetect: false` documents only typed and `describe()` routes;
`autoDetect: { include: ['/api/**'], exclude: ['/internal/**'] }` filters plain routes with
`*` (one segment) and `**` (any depth) globs.

**How mount paths are found.** Express does not expose mount paths (Express 5 keeps no
prefix string at all), so importing `express-api-docs` installs a small recorder on
`Router.prototype.use` and `app.use` that annotates new layers with their mount path. It
never changes routing. Therefore:

- **Import `express-api-docs` before mounting routers.** Routers mounted earlier fall back
  to the Express 4 layer regexp, or to their local path on Express 5, with a warning.
- **A second copy of Express** (pnpm workspaces, monorepos, bundlers that inline Express):
  call `installRecorder(require('express'))` with _your_ copy. Otherwise the first walk logs
  `EAD_RECORDER_NOT_INSTALLED`.
- **No import-time patching:** import from `express-api-docs/manual` (same API) and call
  `installRecorder(express)` yourself.
- **APM agents** that wrap `use()` or layer handles are supported whether they load before
  or after this package.

Anything the walk cannot resolve is logged at `warn` with a stable `EAD_*` code; route
detection never throws.

## Configuration

`createApiDocs(options)` takes one typed object. Every key is optional and has a default
(exported as the deep-frozen `DEFAULT_OPTIONS`). Unknown keys and invalid values throw
`ApiDocsConfigError` synchronously, naming the option path and the allowed values.
Per-route options override global options, which override defaults, as a deep merge in
which arrays replace rather than concatenate. `autoDetect: true | false` is shorthand for
`autoDetect: { enabled }`.

| Option                                | Default           | Description                                                                             |
| ------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `specPath`                            | `"/openapi.json"` | Path of the OpenAPI JSON endpoint.                                                      |
| `docsPath`                            | `"/docs"`         | Path of the docs UI endpoint.                                                           |
| `serveSpec`                           | `true`            | Serve the JSON spec endpoint.                                                           |
| `serveDocs`                           | `true`            | Serve the docs UI endpoint.                                                             |
| `ui`                                  | `"scalar"`        | Docs UI, loaded from a version-pinned CDN.                                              |
| `cdnUrl`                              | `null`            | Override the pinned CDN URL (Scalar: script URL; Swagger UI: swagger-ui-dist base URL). |
| `docs.specUrl`                        | `null`            | URL the docs UI loads the spec from; required when `serveSpec` is false.                |
| `docs.title`                          | `null`            | HTML title of the docs page; null uses `openapi.info.title`.                            |
| `openapi.info.title`                  | `"API"`           | Spec `info.title`.                                                                      |
| `openapi.info.version`                | `"0.0.0"`         | Spec `info.version`.                                                                    |
| `openapi.info.description`            | `null`            | Spec `info.description`; omitted when null.                                             |
| `openapi.info.summary`                | `null`            | Spec `info.summary`; omitted when null.                                                 |
| `openapi.info.termsOfService`         | `null`            | Spec `info.termsOfService`; omitted when null.                                          |
| `openapi.info.contact`                | `null`            | Spec `info.contact`; omitted when null.                                                 |
| `openapi.info.license`                | `null`            | Spec `info.license`; omitted when null.                                                 |
| `openapi.servers`                     | `[]`              | Spec `servers`; omitted when empty.                                                     |
| `openapi.tags`                        | `[]`              | Spec `tags`; omitted when empty.                                                        |
| `securitySchemes`                     | `{}`              | Security schemes, declared once (`components.securitySchemes`).                         |
| `security`                            | `[]`              | Global security requirement; routes without `security` inherit it.                      |
| `tags`                                | `[]`              | Tags for operations that declare none; empty uses `tagStrategy`.                        |
| `validateRequests`                    | `true`            | Validate params, query, headers and body of typed routes.                               |
| `validateResponses`                   | `false`           | Validate typed-route responses: off, log one warning, or send a 500.                    |
| `onValidationError`                   | `null`            | Replace the default 400 problem+json response.                                          |
| `autoDetect.enabled`                  | `true`            | Auto-detect plain routes by walking the router stack.                                   |
| `autoDetect.include`                  | `[]`              | Only auto-detect plain routes matching these globs; empty includes all.                 |
| `autoDetect.exclude`                  | `[]`              | Never auto-detect plain routes matching these globs.                                    |
| `detectedDefaultResponse.status`      | `200`             | Status of the response documented for auto-detected routes.                             |
| `detectedDefaultResponse.description` | `"OK"`            | Description of the response documented for auto-detected routes.                        |
| `operationIdStrategy`                 | `null`            | Custom operationId; null gives `getUsersById` style.                                    |
| `tagStrategy`                         | `null`            | Custom tags; null uses the first static path segment.                                   |
| `adapter`                             | `null`            | Schema adapter; null uses the built-in Standard Schema adapter.                         |
| `logger`                              | `null`            | Logger for warnings; null writes warnings to `console.warn`.                            |

`serveSpec: false` with `serveDocs: true` requires `docs.specUrl`. `api.getSpec()` always
returns the spec programmatically (pass `{ app }` to walk a specific app), for example to
write it to a file in a build script.

### API

| Export                                     | Description                                                          |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `createApiDocs(options?)`                  | Returns `{ router, route, describe, getSpec, invalidate, options }`. |
| `DEFAULT_OPTIONS`                          | Deep-frozen defaults.                                                |
| `ApiDocsConfigError`                       | Thrown for invalid configuration (`path`, `expected`).               |
| `ApiDocsSchemaError`                       | Thrown when a schema validates asynchronously.                       |
| `standardSchemaAdapter`                    | The default adapter.                                                 |
| `installRecorder(express)`                 | Record mount paths for an Express copy.                              |
| `zodAdapter` (from `express-api-docs/zod`) | The Zod 4 adapter.                                                   |

## License

MIT © chitha_srinath
