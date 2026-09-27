// ST-005 (S-05), ADR-18/ADR-23/ADR-43, F-6. `installRecorder(expressModule)`
// wraps the `use` method on the prototype that owns it (found by walking the
// prototype chain — Express 5's Router is two levels deep) and also wraps
// `expressModule.application.use`. Both wrappers call the original first,
// then annotate only the newly pushed layers (`stack.slice(before)`, F-6)
// with `[MOUNT]`/`[CHILD]`. They never change dispatch. Idempotent through the
// `RECORDER` guard on each owner prototype.
import { createRequire } from 'node:module';

import type { Logger } from '../core/types.js';
import { CHILD, MOUNT, RECORDER } from '../core/types.js';
import { isExpress4 } from './sniff.js';

const requireFromHere = createRequire(import.meta.url);

let cachedPackageVersion: string | undefined;
function currentPackageVersion(): string {
  if (cachedPackageVersion !== undefined) return cachedPackageVersion;
  try {
    const pkg = requireFromHere('../../package.json') as { version?: string };
    cachedPackageVersion = pkg.version ?? '0.0.0';
  } catch {
    cachedPackageVersion = '0.0.0';
  }
  return cachedPackageVersion;
}

const PROTOCOL = 1;

interface RecorderTag {
  protocol: number;
  packageVersion: string;
}

export const noopLogger: Logger = {
  debug(): void {
    /* no-op default */
  },
  warn(): void {
    /* no-op default */
  },
};

type UseFn = (this: unknown, ...args: unknown[]) => unknown;
type Owner = Record<PropertyKey, unknown> & { use: UseFn };

function findUseOwner(start: object): Owner {
  let proto: object | null = start;
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'use')) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) {
    throw new Error('express-api-docs: could not locate the prototype that owns `use`');
  }
  return proto as Owner;
}

function isFunctionWithoutOwnStack(value: unknown): value is object {
  return typeof value === 'function' && !Object.prototype.hasOwnProperty.call(value, 'stack');
}

/** @internal exported only for the direct unit test of the no-identifiable-child branch. */
export function annotateNewLayers(stack: unknown[], before: number, args: unknown[], log: Logger): void {
  const newLayers = stack.slice(before) as Array<Record<PropertyKey, unknown>>;
  if (newLayers.length === 0) return;
  const mountPath = typeof args[0] === 'string' ? args[0] : '/';
  const subApp = args.find(isFunctionWithoutOwnStack);
  for (const layer of newLayers) {
    layer[MOUNT] = mountPath;
    if (layer['name'] === 'mounted_app') {
      if (subApp) {
        layer[CHILD] = subApp;
      } else {
        log.warn('EAD_MOUNTED_APP_NO_CHILD', mountPath);
      }
    }
  }
}

function getRouterStack(self: unknown): unknown[] | undefined {
  const stack = (self as { stack?: unknown[] }).stack;
  return Array.isArray(stack) ? stack : undefined;
}

function getApplicationStack(self: unknown): unknown[] | undefined {
  const app = self as { lazyrouter?: () => void; _router?: { stack?: unknown[] }; router?: { stack?: unknown[] } };
  if (isExpress4(app)) {
    app.lazyrouter?.();
    const stack = app._router?.stack;
    return Array.isArray(stack) ? stack : undefined;
  }
  const stack = app.router?.stack;
  return Array.isArray(stack) ? stack : undefined;
}

function installGuarded(owner: Owner, log: Logger, getStack: (self: unknown) => unknown[] | undefined): void {
  const existing = owner[RECORDER] as RecorderTag | undefined;
  if (existing && existing.protocol === PROTOCOL) {
    if (existing.packageVersion !== currentPackageVersion()) {
      log.debug('EAD_RECORDER_VERSION_REUSED', existing.packageVersion, currentPackageVersion());
    }
    return;
  }

  const original = owner.use;
  owner.use = function wrappedUse(this: unknown, ...args: unknown[]): unknown {
    const before = getStack(this)?.length ?? 0;
    const result = original.apply(this, args);
    const stack = getStack(this);
    if (stack) annotateNewLayers(stack, before, args, log);
    return result;
  } as UseFn;

  owner[RECORDER] = { protocol: PROTOCOL, packageVersion: currentPackageVersion() } satisfies RecorderTag;
}

/** Walks the prototype chain from `instance` looking for the `RECORDER` guard. */
export function isRecorderInstalled(instance: object): boolean {
  let proto: object | null = instance;
  while (proto) {
    if (Object.prototype.hasOwnProperty.call(proto, RECORDER)) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

export interface ExpressModuleLike {
  Router: () => object;
  application: object;
}

/**
 * Idempotent through the `RECORDER` guard on each owner prototype. Never
 * changes dispatch: the wrappers call the original `use` first, then only
 * annotate `stack.slice(before)`.
 */
export function installRecorder(expressModule: unknown, log: Logger = noopLogger): void {
  const mod = expressModule as ExpressModuleLike;
  const routerInstance = mod.Router();
  const routerOwner = findUseOwner(Object.getPrototypeOf(routerInstance));
  installGuarded(routerOwner, log, getRouterStack);

  const appOwner = mod.application as Owner;
  installGuarded(appOwner, log, getApplicationStack);
}
