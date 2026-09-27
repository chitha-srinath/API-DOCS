import {
  CHILD,
  HTTP_METHODS,
  META,
  MOUNT,
  type HandlerTag,
  type HttpMethod,
  type InternalTag,
  type Logger,
  type OperationMeta,
  type RegistryEntry,
  type RouteRegistry,
} from '../core/types.js';
import { prefixFromRegexp } from './express4.js';
import { convertPath, joinPaths, type ExpressMajor } from './paths.js';
import {
  isApp,
  isExpress4,
  isRecorded,
  isRouter,
  rootRouter,
  type AppLike,
  type LayerLike,
  type RouterLike,
} from './recorder.js';

/** One discovered route before path conversion. */
export interface RawOperation {
  method: HttpMethod;
  /** Full Express path including mount prefixes (a RegExp route stays a RegExp). */
  expressPath: string | RegExp;
  major: ExpressMajor;
  source: 'typed' | 'describe' | 'plain';
  meta?: OperationMeta;
  entry?: RegistryEntry;
}

export interface WalkResult {
  operations: RawOperation[];
  /** Registry entries that were not found in the stack. */
  unlocated: RegistryEntry[];
}

const METHODS: ReadonlySet<string> = new Set(HTTP_METHODS);

function tagOf(fn: unknown): Partial<HandlerTag & InternalTag> | undefined {
  if (typeof fn !== 'function') return undefined;
  return (fn as unknown as Record<PropertyKey, unknown>)[META] as
    Partial<HandlerTag & InternalTag> | undefined;
}

/** Mark the package's own spec/docs handlers so the walk never documents them. */
export function markInternal(fn: object): void {
  Object.defineProperty(fn, META, { value: { internal: true } satisfies InternalTag });
}

/** Resolve the application to walk: the topmost ancestor of `app`. */
export function topApp(app: AppLike, logger: Logger): AppLike {
  let current = app;
  if (current.parent) {
    logger.warn(
      'The docs router is mounted inside a sub-app; walking from the top-level app instead.',
      { code: 'EAD_MOUNTED_IN_SUBAPP' },
    );
  }
  while (current.parent && isApp(current.parent)) current = current.parent;
  return current;
}

/** Cheap structural fingerprint: total layers across nested stacks and routes. */
export function fingerprint(app: AppLike): number {
  const seen = new Set<unknown>();
  const count = (router: RouterLike | undefined): number => {
    if (!router || seen.has(router)) return 0;
    seen.add(router);
    let total = 0;
    for (const layer of router.stack) {
      total += 1;
      try {
        if (layer.route) total += layer.route.stack.length;
        const target = layer[MOUNT]?.target ?? (isRouter(layer.handle) ? layer.handle : undefined);
        if (target) total += count(target);
        const child = layer[CHILD];
        if (child) total += count(safeRoot(child));
      } catch {
        total += 1;
      }
    }
    return total;
  };
  return count(safeRoot(app));
}

function safeRoot(app: AppLike): RouterLike | undefined {
  try {
    return rootRouter(app);
  } catch {
    return undefined;
  }
}

class Walker {
  readonly operations: RawOperation[] = [];
  private readonly located = new Set<RegistryEntry>();
  /** Routers on the current recursion path: a cycle guard, not a dedupe. */
  private readonly active = new Set<unknown>();
  private readonly warned = new Set<string>();

  constructor(
    private readonly registry: RouteRegistry,
    private readonly logger: Logger,
  ) {}

  warnOnce(key: string, message: string, code: Parameters<Logger['warn']>[1]): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.logger.warn(message, code);
  }

  walkApp(app: AppLike, prefix: string): void {
    const major: ExpressMajor = isExpress4(app) ? 4 : 5;
    const root = rootRouter(app);
    if (!root) return;
    if (!isRecorded(root)) {
      this.warnOnce(
        'recorder',
        'The Express copy used by this app has no mount recorder, so mount prefixes may be ' +
          'missing. Call installRecorder(require("express")) before mounting routers.',
        { code: 'EAD_RECORDER_NOT_INSTALLED' },
      );
    }
    this.walkRouter(root, prefix, major);
  }

  private walkRouter(router: RouterLike, prefix: string, major: ExpressMajor): void {
    if (this.active.has(router)) return;
    this.active.add(router);
    router.stack.forEach((layer, index) => {
      try {
        this.walkLayer(layer, prefix, major);
      } catch (error) {
        this.warnOnce(
          `threw:${prefix}:${index}`,
          `Skipped a router layer at "${prefix || '/'}" because inspecting it threw: ${String(error)}`,
          { code: 'EAD_LAYER_THREW' },
        );
      }
    });
    this.active.delete(router);
  }

  private walkLayer(layer: LayerLike, prefix: string, major: ExpressMajor): void {
    if (typeof layer !== 'object' || layer === null) {
      this.warnOnce(`shape:${prefix}`, `Unrecognised router layer under "${prefix || '/'}".`, {
        code: 'EAD_LAYER_UNRECOGNISED',
      });
      return;
    }
    if (layer.route) {
      this.walkRoute(layer, prefix, major);
      return;
    }
    const annotation = layer[MOUNT];
    const child = layer[CHILD];
    const target = annotation?.target ?? (isRouter(layer.handle) ? layer.handle : undefined);
    if (!target && !child) {
      if (layer.name === 'mounted_app') {
        this.warnOnce(
          `subapp:${prefix}:${String(annotation?.path)}`,
          `A sub-app mounted under "${prefix || '/'}" was mounted before the recorder was ` +
            'installed; its routes are not documented. Import express-api-docs first.',
          { code: 'EAD_SUBAPP_UNRECORDED' },
        );
      } else if (typeof layer.handle !== 'function') {
        this.warnOnce(
          `shape:${prefix}:${String(layer.name)}`,
          `Unrecognised router layer under "${prefix || '/'}".`,
          {
            code: 'EAD_LAYER_UNRECOGNISED',
          },
        );
      }
      return;
    }
    if (tagOf(target)?.internal) return;
    for (const mount of this.mountPaths(layer, prefix, major)) {
      const nextPrefix = joinPaths(prefix, mount);
      if (target) this.walkRouter(target, nextPrefix, major);
      if (child) {
        const childMajor: ExpressMajor = isExpress4(child) ? 4 : 5;
        const childRoot = rootRouter(child);
        if (childRoot) this.walkRouter(childRoot, nextPrefix, childMajor);
      }
    }
  }

  private mountPaths(layer: LayerLike, prefix: string, major: ExpressMajor): string[] {
    const annotation = layer[MOUNT];
    if (annotation) {
      const paths = Array.isArray(annotation.path)
        ? annotation.path.flat(Infinity)
        : [annotation.path];
      const strings = paths.filter((p): p is string => typeof p === 'string');
      if (strings.length === paths.length) return strings;
      this.warnOnce(
        `mount:${prefix}:${String(annotation.path)}`,
        `A router mounted under "${prefix || '/'}" with a RegExp path cannot be documented ` +
          'with its prefix; its routes use the local path.',
        { code: 'EAD_MOUNT_UNRECOVERABLE' },
      );
      return strings.length > 0 ? strings : [''];
    }
    if (major === 4) {
      const recovered = prefixFromRegexp(layer);
      if (recovered !== undefined) return [recovered];
    }
    this.warnOnce(
      `mount:${prefix}:${String(layer.regexp ?? layer.name)}`,
      `The mount path of a router under "${prefix || '/'}" could not be recovered (it was ` +
        'mounted before the recorder was installed); its routes use the local path.',
      { code: 'EAD_MOUNT_UNRECOVERABLE' },
    );
    return [''];
  }

  private walkRoute(layer: LayerLike, prefix: string, major: ExpressMajor): void {
    const route = layer.route as NonNullable<LayerLike['route']>;
    const routePaths = Array.isArray(route.path) ? route.path.flat(Infinity) : [route.path];
    const methods: HttpMethod[] = [];
    for (const item of route.stack) {
      const method = typeof item.method === 'string' ? item.method.toLowerCase() : undefined;
      if (method && METHODS.has(method) && !methods.includes(method as HttpMethod)) {
        methods.push(method as HttpMethod);
      }
    }
    for (const method of methods) {
      const handles = route.stack
        .filter((item) => item.method?.toLowerCase() === method)
        .map((item) => item.handle);
      if (handles.some((handle) => tagOf(handle)?.internal)) continue;
      let entry: RegistryEntry | undefined;
      for (const handle of handles) {
        entry = this.registry.findByHandle(handle);
        if (entry) break;
      }
      const foreign = entry ? undefined : handles.map(tagOf).find((tag) => tag?.source);
      if (entry) this.located.add(entry);
      for (const routePath of routePaths) {
        const expressPath =
          typeof routePath === 'string' ? joinPaths(prefix, routePath) : (routePath as RegExp);
        this.operations.push({
          method,
          expressPath,
          major,
          source: entry?.source ?? foreign?.source ?? 'plain',
          meta: entry?.meta ?? foreign?.meta,
          entry,
        });
      }
    }
  }

  unlocated(): RegistryEntry[] {
    return this.registry.entries().filter((entry) => !this.located.has(entry));
  }
}

/**
 * Walk an app's router stack (never throws): typed/`describe()` routes are matched to
 * registry entries by handler identity to learn their full paths; everything else with
 * a route is a plain route.
 */
export function introspect(
  app: AppLike | undefined,
  registry: RouteRegistry,
  logger: Logger,
): WalkResult {
  const walker = new Walker(registry, logger);
  if (app) {
    try {
      walker.walkApp(topApp(app, logger), '');
    } catch (error) {
      logger.warn(`Route detection failed: ${String(error)}`, { code: 'EAD_LAYER_THREW' });
    }
  }
  return { operations: walker.operations, unlocated: walker.unlocated() };
}

export { convertPath };
