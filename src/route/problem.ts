// ST-004 (S-04, component C3): RFC 9457 problem+json shape shared by
// request-validation failures. AC-011 (schema-part only): this story exports
// only the ProblemDetails JSON Schema and the media-type constant; wiring the
// `$ref` into the generated spec is S-06's job.

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export type ProblemErrorLocation = 'path' | 'query' | 'body';

export interface ProblemError {
  readonly in: ProblemErrorLocation;
  readonly path: string;
  readonly message: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors: ProblemError[];
}

/** Plain JSON Schema (draft 2020-12 compatible) describing `ProblemDetails`. */
export const PROBLEM_DETAILS_SCHEMA: Record<string, unknown> = Object.freeze({
  type: 'object',
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    detail: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          in: { type: 'string', enum: ['path', 'query', 'body'] },
          path: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['in', 'path', 'message'],
      },
    },
  },
  required: ['type', 'title', 'status', 'detail', 'errors'],
});

export function buildProblem(status: number, title: string, detail: string, errors: ProblemError[]): ProblemDetails {
  return {
    type: 'about:blank',
    title,
    status,
    detail,
    errors,
  };
}
