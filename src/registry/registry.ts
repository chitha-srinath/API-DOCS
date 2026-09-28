// ST-004 (S-04, component C12, ADR-17/ADR-27c): the per-instance RouteRegistry.
// `src/core/types.ts` (S-01) pins the `RegistryEntry`/`RouteRegistry` contract;
// this file implements it and must never redeclare it.
import type { RegistryEntry, RouteRegistry } from '../core/types.js';

export function createRegistry(): RouteRegistry {
  const entries: RegistryEntry[] = [];
  let nextId = 1;

  return {
    register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry {
      const full: RegistryEntry = { ...entry, id: nextId };
      nextId += 1;
      entries.push(full);
      return full;
    },

    entries(): readonly RegistryEntry[] {
      return entries.slice();
    },

    findByHandle(fn: unknown): RegistryEntry | undefined {
      if (typeof fn !== 'function') return undefined;
      return entries.find((entry) => entry.validatorFn === fn || entry.handlerFn === fn);
    },
  };
}
