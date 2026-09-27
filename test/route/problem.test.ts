import { describe, expect, it } from 'vitest';
import { buildProblem, PROBLEM_CONTENT_TYPE, PROBLEM_DETAILS_SCHEMA } from '../../src/route/problem.js';

describe('route/problem: ProblemDetails schema (AC-011 schema part)', () => {
  it('media type constant is application/problem+json', () => {
    expect(PROBLEM_CONTENT_TYPE).toBe('application/problem+json');
  });

  it('schema declares type, title, status, detail, errors as required', () => {
    expect(PROBLEM_DETAILS_SCHEMA.required).toEqual(['type', 'title', 'status', 'detail', 'errors']);
    const properties = PROBLEM_DETAILS_SCHEMA.properties as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual(['type', 'title', 'status', 'detail', 'errors']);
  });

  it('errors items require in/path/message, and in is enum path|query|body', () => {
    const schema = PROBLEM_DETAILS_SCHEMA as {
      properties: { errors: { items: { required: string[]; properties: { in: { enum: string[] } } } } };
    };
    const items = schema.properties.errors.items;
    expect(items.required).toEqual(['in', 'path', 'message']);
    expect(items.properties.in.enum).toEqual(['path', 'query', 'body']);
  });

  it('buildProblem returns the exact shape', () => {
    const problem = buildProblem(400, 'Bad Request', 'nope', [{ in: 'body', path: 'a', message: 'required' }]);
    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'nope',
      errors: [{ in: 'body', path: 'a', message: 'required' }],
    });
  });
});
