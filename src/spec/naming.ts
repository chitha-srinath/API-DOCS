import type { OperationNamingInput } from '../config/types.js';

function pascal(word: string): string {
  return word
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/** A-3: `GET /users/{id}` gives `getUsersById`; `GET /` gives `getRoot`. */
export function defaultOperationId(op: OperationNamingInput): string {
  const parts = op.path.split('/').filter(Boolean);
  const words = parts.map((segment) =>
    segment.replace(/\{([^}]+)\}/g, (_m, name: string) => ` By ${pascal(name)} `),
  );
  const suffix = words.map(pascal).join('');
  return `${op.method}${suffix || 'Root'}`;
}

/** A-4: the first static path segment, e.g. `/api/users/{id}` gives `['api']`. */
export function defaultTags(op: OperationNamingInput): string[] {
  const first = op.path.split('/').find((segment) => segment !== '' && !segment.startsWith('{'));
  return first ? [first] : [];
}
