// ST-007 (S-07): `express-api-docs/zod` subpath. Exports `zodAdapter` and
// re-exports `ApiDocsSchemaError`, nothing else (ADR-41). The main entry and
// `./manual` must never import `zod` or export `zodAdapter`.
export { zodAdapter } from './adapter/zod.js';
export { ApiDocsSchemaError } from './adapter/errors.js';
