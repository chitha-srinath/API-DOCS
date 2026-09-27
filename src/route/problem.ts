import type { ValidationIssue } from '../core/types.js';

export const PROBLEM_MEDIA_TYPE = 'application/problem+json';
export const PROBLEM_SCHEMA_NAME = 'ProblemDetails';

/** RFC 9457 problem details body for a failed request validation. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: ValidationIssue[];
}

/** JSON Schema of `ProblemDetails`, referenced from every typed operation's `400`. */
export const PROBLEM_JSON_SCHEMA = {
  type: 'object',
  description: 'RFC 9457 problem details.',
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
          in: { type: 'string', enum: ['path', 'query', 'header', 'body'] },
          path: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['in', 'path', 'message'],
      },
    },
  },
  required: ['type', 'title', 'status', 'detail'],
} as const;

export function validationProblem(issues: ValidationIssue[]): ProblemDetails {
  const count = issues.length;
  return {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail: `Request validation failed with ${count} ${count === 1 ? 'issue' : 'issues'}.`,
    errors: issues,
  };
}

export function responseProblem(): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'The response did not match its declared schema.',
  };
}
