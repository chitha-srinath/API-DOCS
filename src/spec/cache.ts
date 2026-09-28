// ST-006 (S-06, component C7): a lazy cache keyed on a nested fingerprint —
// the total layer count, summed recursively across nested router stacks
// (ADR-09). `invalidate()` clears it (ADR-02: a layer replaced in place with
// an equal count still evades the fingerprint; accepted risk, ADR-02/ADR-03).

interface StackHolder {
  stack?: unknown[];
}

interface AppLike {
  _router?: StackHolder;
  router?: StackHolder;
}

function countLayers(stack: unknown[] | undefined): number {
  if (!Array.isArray(stack)) return 0;
  let count = stack.length;
  for (const layerUnknown of stack) {
    const layer = layerUnknown as Record<string, unknown>;
    if (layer['route']) continue; // route layers have no nested router stack.
    const handle = layer['handle'] as StackHolder | undefined;
    if (handle && Array.isArray(handle.stack)) {
      count += countLayers(handle.stack);
    }
  }
  return count;
}

/** The nested fingerprint for `app`: total layer count across nested stacks. */
export function fingerprint(app: unknown): number {
  const holder = app as AppLike;
  const stack = holder._router?.stack ?? holder.router?.stack;
  return countLayers(stack);
}

export interface SpecCache<T> {
  /** Returns the cached value when `app`'s fingerprint is unchanged, else rebuilds via `build`. */
  get(app: unknown, build: () => T): T;
  invalidate(): void;
}

export function createSpecCache<T>(): SpecCache<T> {
  let hasValue = false;
  let lastFingerprint: number | undefined;
  let lastResult: T | undefined;

  return {
    get(app: unknown, build: () => T): T {
      const current = fingerprint(app);
      if (hasValue && current === lastFingerprint) {
        return lastResult as T;
      }
      const result = build();
      hasValue = true;
      lastFingerprint = current;
      lastResult = result;
      return result;
    },
    invalidate(): void {
      hasValue = false;
      lastFingerprint = undefined;
      lastResult = undefined;
    },
  };
}
