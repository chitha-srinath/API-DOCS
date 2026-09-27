import { describe, expect, it } from 'vitest';
import {
  PROBLEM_JSON_SCHEMA,
  PROBLEM_MEDIA_TYPE,
  PROBLEM_SCHEMA_NAME,
  responseProblem,
  validationProblem,
} from '../../src/route/problem.js';

describe('problem details (AC-011 schema part)', () => {
  it('exposes the media type and schema name', () => {
    expect(PROBLEM_MEDIA_TYPE).toBe('application/problem+json');
    expect(PROBLEM_SCHEMA_NAME).toBe('ProblemDetails');
  });

  it('schema has type/title/status/detail and errors items {in, path, message}', () => {
    expect(Object.keys(PROBLEM_JSON_SCHEMA.properties)).toEqual([
      'type',
      'title',
      'status',
      'detail',
      'errors',
    ]);
    expect(PROBLEM_JSON_SCHEMA.required).toEqual(['type', 'title', 'status', 'detail']);
    const items = PROBLEM_JSON_SCHEMA.properties.errors.items;
    expect(items.required).toEqual(['in', 'path', 'message']);
    expect(items.properties.in.enum).toEqual(['path', 'query', 'header', 'body']);
  });

  it('builds validation and response problems', () => {
    expect(validationProblem([])).toMatchObject({
      status: 400,
      detail: 'Request validation failed with 0 issues.',
    });
    expect(responseProblem().status).toBe(500);
  });
});
