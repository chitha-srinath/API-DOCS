/** Thrown when a schema cannot be used at request time, e.g. it validates asynchronously. */
export class ApiDocsSchemaError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiDocsSchemaError';
    this.code = code;
  }
}
