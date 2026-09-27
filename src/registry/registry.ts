import type { RegistryEntry, RouteRegistry } from '../core/types.js';

/** Per-instance record of typed and `describe()` routes, populated at declaration. */
export class Registry implements RouteRegistry {
  private readonly list: RegistryEntry[] = [];
  private readonly byHandle = new Map<unknown, RegistryEntry>();

  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry {
    const registered: RegistryEntry = Object.freeze({ ...entry, id: this.list.length + 1 });
    this.list.push(registered);
    this.byHandle.set(registered.handlerFn, registered);
    if (registered.validatorFn) this.byHandle.set(registered.validatorFn, registered);
    return registered;
  }

  entries(): readonly RegistryEntry[] {
    return [...this.list];
  }

  findByHandle(fn: unknown): RegistryEntry | undefined {
    return typeof fn === 'function' ? this.byHandle.get(fn) : undefined;
  }
}

export function createRegistry(): RouteRegistry {
  return new Registry();
}
