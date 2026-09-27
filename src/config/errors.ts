/** Thrown synchronously by `createApiDocs()` for an unknown key or an invalid value. */
export class ApiDocsConfigError extends Error {
  /** Dotted option path, e.g. `openapi.info.title`. */
  readonly path: string;
  /** The allowed values or the expected type. */
  readonly expected: string;

  constructor(path: string, expected: string, message?: string) {
    super(message ?? `Invalid option "${path}": expected ${expected}.`);
    this.name = 'ApiDocsConfigError';
    this.path = path;
    this.expected = expected;
  }
}
