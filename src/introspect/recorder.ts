import { CHILD, MOUNT, RECORDER } from '../core/types.js';

/** Annotation stored on a layer created by `use()`. */
export interface MountAnnotation {
  /** The path argument given to `use()`; `/` when omitted. */
  readonly path: unknown;
  /** The mounted router, kept even if a later wrapper replaces `layer.handle`. */
  readonly target?: RouterLike;
}

export interface LayerLike {
  handle?: unknown;
  name?: string;
  route?: RouteLike;
  regexp?: RegExp & { fast_slash?: boolean };
  keys?: Array<{ name: string | number; optional?: boolean }>;
  [MOUNT]?: MountAnnotation;
  [CHILD]?: AppLike;
}

export interface RouteLike {
  path: unknown;
  stack: Array<{ method?: string; handle?: unknown }>;
}

export interface RouterLike {
  (...args: never[]): unknown;
  stack: LayerLike[];
  use: (...args: unknown[]) => unknown;
}

export interface AppLike {
  (...args: never[]): unknown;
  use: (...args: unknown[]) => unknown;
  handle: (...args: unknown[]) => unknown;
  set: (...args: unknown[]) => unknown;
  parent?: AppLike;
  lazyrouter?: () => void;
  _router?: RouterLike;
  router?: RouterLike;
}

interface ExpressModuleLike {
  (...args: never[]): unknown;
  Router: (...args: never[]) => unknown;
  application: { use: (...args: unknown[]) => unknown };
}

const hasOwn = (object: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

export function isRouter(value: unknown): value is RouterLike {
  return (
    typeof value === 'function' &&
    Array.isArray((value as Partial<RouterLike>).stack) &&
    typeof (value as Partial<RouterLike>).use === 'function'
  );
}

export function isApp(value: unknown): value is AppLike {
  return (
    typeof value === 'function' &&
    typeof (value as Partial<AppLike>).handle === 'function' &&
    typeof (value as Partial<AppLike>).set === 'function'
  );
}

/** Express 4 vs 5 by keys only; never reads `app.router` on v4 (it throws there). */
export function isExpress4(app: AppLike): boolean {
  return hasOwn(app, '_router') || typeof app.lazyrouter === 'function';
}

export function rootRouter(app: AppLike): RouterLike | undefined {
  if (isExpress4(app)) {
    app.lazyrouter?.();
    return app._router;
  }
  return app.router;
}

/** The prototype that owns `use` (two levels up on Express 5, one on Express 4). */
export function useOwner(router: object): object | undefined {
  let proto: object | null = Object.getPrototypeOf(router) as object | null;
  while (proto && !hasOwn(proto, 'use')) proto = Object.getPrototypeOf(proto) as object | null;
  return proto ?? undefined;
}

export function isRecorded(router: object): boolean {
  const owner = useOwner(router);
  return owner !== undefined && hasOwn(owner, RECORDER);
}

/** Split `use()` arguments exactly as Express does: optional path, then handlers. */
function splitUseArgs(args: unknown[]): { path: unknown; fns: unknown[] } {
  let path: unknown = '/';
  let offset = 0;
  const first = args[0];
  if (typeof first !== 'function') {
    let arg = first;
    while (Array.isArray(arg) && arg.length !== 0) arg = arg[0];
    if (typeof arg !== 'function') {
      offset = 1;
      path = first;
    }
  }
  return { path, fns: args.slice(offset).flat(Infinity) };
}

function markPatched(owner: object): void {
  Object.defineProperty(owner, RECORDER, { value: true, configurable: true });
}

function patchRouterUse(owner: { use: (...args: unknown[]) => unknown }): void {
  if (hasOwn(owner, RECORDER)) return;
  const original = owner.use;
  owner.use = function recordedUse(this: RouterLike, ...args: unknown[]) {
    const before = Array.isArray(this.stack) ? this.stack.length : 0;
    const result = original.apply(this, args);
    try {
      const { path, fns } = splitUseArgs(args);
      this.stack.slice(before).forEach((layer, i) => {
        const fn = fns[i];
        const annotation: MountAnnotation = isRouter(fn) ? { path, target: fn } : { path };
        Object.defineProperty(layer, MOUNT, { value: annotation, configurable: true });
      });
    } catch {
      // recording is best-effort and must never change dispatch
    }
    return result;
  };
  markPatched(owner);
}

function safeLength(app: AppLike): number {
  try {
    return rootRouter(app)?.stack.length ?? 0;
  } catch {
    return 0;
  }
}

function patchAppUse(application: { use: (...args: unknown[]) => unknown }): void {
  if (hasOwn(application, RECORDER)) return;
  const original = application.use;
  application.use = function recordedAppUse(this: AppLike, ...args: unknown[]) {
    const before = safeLength(this);
    const result = original.apply(this, args);
    try {
      const { fns } = splitUseArgs(args);
      const stack = rootRouter(this)?.stack ?? [];
      stack.slice(before).forEach((layer, i) => {
        const fn = fns[i];
        if (isApp(fn)) Object.defineProperty(layer, CHILD, { value: fn, configurable: true });
      });
    } catch {
      // best-effort, as above
    }
    return result;
  };
  markPatched(application);
}

/**
 * Record mount paths for routers and sub-apps created by this Express module, so the
 * spec can show full paths such as `/api/users/{id}` on Express 4 and 5. Only annotates
 * layers; never changes routing. Idempotent. Call it yourself for a second Express copy
 * (pnpm, monorepos, bundlers) or when importing from `express-api-docs/manual`.
 * Returns `true` when it patched something new.
 */
export function installRecorder(expressModule: unknown): boolean {
  const mod = (
    typeof expressModule === 'object' && expressModule !== null && 'default' in expressModule
      ? (expressModule as { default: unknown }).default
      : expressModule
  ) as ExpressModuleLike;
  if (
    typeof mod !== 'function' ||
    typeof mod.Router !== 'function' ||
    typeof mod.application?.use !== 'function'
  ) {
    throw new TypeError('installRecorder() expects the express module, e.g. require("express").');
  }
  const owner = useOwner(mod.Router() as object) as { use: (...args: unknown[]) => unknown };
  const wasInstalled = hasOwn(owner, RECORDER) && hasOwn(mod.application, RECORDER);
  patchRouterUse(owner);
  patchAppUse(mod.application);
  return !wasInstalled;
}
