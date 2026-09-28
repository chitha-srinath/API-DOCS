// ST-006 (S-06, component C6): default operationId / tag naming (A-3, A-4)
// and the A-3 collision-suffix mechanism, ordered by registration id so
// output stays byte-stable regardless of array order (AC-034).

function capitalize(segment: string): string {
  if (segment.length === 0) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

const BRACED = /^\{([^}]+)\}$/;

/** A-3 default: `GET /users/:id` (`/users/{id}`) -> `getUsersById`. */
export function defaultOperationId(method: string, path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const parts = segments.map((segment) => {
    const match = BRACED.exec(segment);
    if (match) return `By${capitalize(match[1] as string)}`;
    return capitalize(segment);
  });
  return `${method.toLowerCase()}${parts.join('')}`;
}

/** A-4 default: the first static (non-`{param}`) segment of the full mounted path. */
export function defaultTag(path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const first = segments.find((segment) => !BRACED.test(segment));
  return first ?? '';
}

export interface OperationIdInput {
  readonly id: number;
  readonly base: string;
}

/**
 * Assigns collision-free operationIds. Suffixing order follows `id`
 * (registration order), never array position, so the result is identical no
 * matter how the caller orders `entries` (AC-034). Returns a map keyed by
 * `id` so callers may look up the resolved id regardless of input order.
 */
export function assignOperationIds(entries: readonly OperationIdInput[]): Map<number, string> {
  const byId = [...entries].sort((a, b) => a.id - b.id);
  const counts = new Map<string, number>();
  const resolved = new Map<number, string>();
  for (const entry of byId) {
    const count = counts.get(entry.base) ?? 0;
    counts.set(entry.base, count + 1);
    resolved.set(entry.id, count === 0 ? entry.base : `${entry.base}${count + 1}`);
  }
  return resolved;
}
