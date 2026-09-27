# Basic example

```sh
npm install
npm run build
npm run example
```

Then open <http://localhost:3000/docs> (Scalar) or <http://localhost:3000/openapi.json>.

- `GET /api/users/:id` and `POST /api/users` are typed routes: requests are validated
  and the spec is generated from their Zod schemas.
- `GET /api/health` is a plain Express route; it is documented automatically.
