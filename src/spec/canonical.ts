// ST-006 (S-06, component C6): canonical key sort. Recursive over object
// keys; arrays keep semantic order (never sorted); `undefined` is never
// emitted. Pure, deterministic (AC-034 byte identity).

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const item = input[key];
      if (item === undefined) continue;
      output[key] = canonicalize(item);
    }
    return output;
  }
  return value;
}
