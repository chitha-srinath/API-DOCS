// ST-005 (S-05), component C5 (architecture.md, verbatim):
// `introspect(app, registry, log): DetectedOperation[]`. Detection never
// throws (R-1): degrades to an empty/partial result instead of an exception.
import type { DetectedOperation, HttpMethod, Logger, OperationMeta, RouteRegistry } from '../core/types.js';
import { META } from '../core/types.js';
import { convertExpressPath } from './paths.js';
import { CHILD, MOUNT } from '../core/types.js';
import { isRecorderInstalled } from './recorder.js';
import { sniffRoot } from './sniff.js';

export interface IntrospectOptions {
  /** AC-030 walk side: `false` suppresses `source: 'plain'` operations. */
  autoDetect?: boolean;
  /** AC-033: the package's own spec/docs paths, excluded from the result. */
  ownPaths?: string[];
}

interface AppLike {
  parent?: unknown;
  lazyrouter?: () => void;
  _router?: { stack?: unknown[] };
  router?: { stack?: unknown[] };
}

interface MetaTag {
  source: 'typed' | 'describe';
  method?: HttpMethod;
  meta: OperationMeta;
}

interface WalkContext {
  registry: RouteRegistry;
  log: Logger;
  seenIds: Set<number>;
  results: DetectedOperation[];
  autoDetect: boolean;
  ownPaths: Set<string>;
  recorderInstalled: boolean;
}

function readMetaTag(fn: unknown): MetaTag | undefined {
  if (typeof fn !== 'function') return undefined;
  const tag = (fn as unknown as Record<PropertyKey, unknown>)[META];
  return tag as MetaTag | undefined;
}

function emit(
  ctx: WalkContext,
  method: HttpMethod,
  path: string,
  pathParams: string[],
  source: DetectedOperation['source'],
  meta?: OperationMeta,
): void {
  if (ctx.ownPaths.has(path)) return;
  if (source === 'plain' && !ctx.autoDetect) return;
  const op: DetectedOperation = { method, path, pathParams, source };
  if (meta !== undefined) op.meta = meta;
  ctx.results.push(op);
}

function handleRouteHandler(
  ctx: WalkContext,
  method: HttpMethod,
  fullPath: string,
  pathParams: string[],
  handlerFn: unknown,
): void {
  const registryEntry = ctx.registry.findByHandle(handlerFn);
  if (registryEntry) {
    ctx.seenIds.add(registryEntry.id);
    emit(ctx, method, fullPath, pathParams, registryEntry.source, registryEntry.meta);
    return;
  }

  const tag = readMetaTag(handlerFn);
  if (tag) {
    emit(ctx, method, fullPath, pathParams, tag.source, tag.meta);
    return;
  }

  emit(ctx, method, fullPath, pathParams, 'plain');
}

function joinPath(prefix: string, segment: string): string {
  const joined = `${prefix}${segment}`;
  if (joined === '') return '/';
  return joined.startsWith('/') ? joined : `/${joined}`;
}

function handleRoute(
  ctx: WalkContext,
  route: { path?: unknown; stack?: Array<{ method?: string; handle: unknown }> },
  prefix: string,
): void {
  const converted = convertExpressPath(route.path, ctx.log);
  if (!converted) return;
  const methodLayers = Array.isArray(route.stack) ? route.stack : [];
  const seenMethods = new Set<string>();
  for (const methodLayer of methodLayers) {
    const method = (methodLayer.method ?? '').toLowerCase();
    if (!method || seenMethods.has(method)) continue;
    seenMethods.add(method);
    for (const variant of converted) {
      const fullPath = joinPath(prefix, variant.path);
      handleRouteHandler(ctx, method as HttpMethod, fullPath, variant.pathParams, methodLayer.handle);
    }
  }
}

function resolveMountPrefix(layer: Record<PropertyKey, unknown>, ctx: WalkContext): string {
  const annotated = layer[MOUNT];
  if (typeof annotated === 'string') return annotated === '/' ? '' : annotated;

  if (!ctx.recorderInstalled) {
    // ADR-34: "local-path fallback" — the single EAD_RECORDER_NOT_INSTALLED
    // warn already covers this walk; do not also warn per-layer.
    return '';
  }

  const regexp = layer['regexp'];
  if (regexp instanceof RegExp) {
    const fromRegexp = prefixFromRegexp(regexp);
    if (fromRegexp !== undefined) return fromRegexp;
  }

  ctx.log.warn('EAD_MOUNT_PREFIX_UNRECOVERABLE');
  return '';
}

const REGEXP_PREFIX = '^\\/';
const REGEXP_SUFFIXES = ['\\/?(?=\\/|$)', '\\/?$'];

function prefixFromRegexp(re: RegExp): string | undefined {
  const src = re.source;
  if (!src.startsWith(REGEXP_PREFIX)) return undefined;
  for (const suffix of REGEXP_SUFFIXES) {
    if (src.length >= REGEXP_PREFIX.length + suffix.length && src.endsWith(suffix)) {
      const middle = src.slice(REGEXP_PREFIX.length, src.length - suffix.length);
      return middle === '' ? '' : `/${middle.split('\\/').join('/')}`;
    }
  }
  return undefined;
}

function childRoot(child: {
  lazyrouter?: () => void;
  _router?: { stack?: unknown[] };
  router?: { stack?: unknown[] };
}): unknown[] | undefined {
  if (typeof child.lazyrouter === 'function') {
    child.lazyrouter();
    return child._router?.stack;
  }
  return child.router?.stack;
}

function handleLayer(ctx: WalkContext, layer: Record<PropertyKey, unknown>, prefix: string): void {
  const route = layer['route'] as { path?: unknown; stack?: Array<{ method?: string; handle: unknown }> } | undefined;
  if (route) {
    handleRoute(ctx, route, prefix);
    return;
  }

  const name = layer['name'];
  if (name === 'router') {
    const handle = layer['handle'] as { stack?: unknown[] } | undefined;
    if (handle && Array.isArray(handle.stack)) {
      const mount = resolveMountPrefix(layer, ctx);
      walkStack(ctx, handle.stack, `${prefix}${mount}`);
    } else {
      ctx.log.warn('EAD_LAYER_UNRECOGNISED', 'router-without-stack');
    }
    return;
  }

  if (name === 'mounted_app') {
    const child = layer[CHILD] as
      { lazyrouter?: () => void; _router?: { stack?: unknown[] }; router?: { stack?: unknown[] } } | undefined;
    if (!child) {
      ctx.log.warn('EAD_SUBAPP_UNRECORDED');
      return;
    }
    const mount = resolveMountPrefix(layer, ctx);
    const stack = childRoot(child);
    if (Array.isArray(stack)) walkStack(ctx, stack, `${prefix}${mount}`);
    return;
  }

  // ordinary middleware (body parsers, etc.): not a route, nothing to record.
}

function walkStack(ctx: WalkContext, stack: unknown[], prefix: string): void {
  for (const layerUnknown of stack) {
    try {
      handleLayer(ctx, layerUnknown as Record<PropertyKey, unknown>, prefix);
    } catch (err) {
      ctx.log.warn('EAD_LAYER_THREW', err instanceof Error ? err.message : String(err));
    }
  }
}

function resolveTopmost(appIn: AppLike, log: Logger): AppLike {
  let app = appIn;
  if (app.parent) {
    log.warn('EAD_MOUNTED_IN_SUBAPP');
    while (app.parent) app = app.parent as AppLike;
  }
  return app;
}

function introspectUnsafe(
  appIn: unknown,
  registry: RouteRegistry,
  log: Logger,
  options: IntrospectOptions,
): DetectedOperation[] {
  const app = resolveTopmost(appIn as AppLike, log);
  const { root } = sniffRoot(app);

  // Router instances are callable (typeof 'function'), not plain objects —
  // guard on nullishness only, not `typeof === 'object'`.
  const recorderInstalled =
    root != null && (typeof root === 'object' || typeof root === 'function')
      ? isRecorderInstalled(root as object)
      : true;

  const ctx: WalkContext = {
    registry,
    log,
    seenIds: new Set(),
    results: [],
    autoDetect: options.autoDetect ?? true,
    ownPaths: new Set(options.ownPaths ?? []),
    recorderInstalled,
  };

  if (!recorderInstalled) {
    log.warn(
      'EAD_RECORDER_NOT_INSTALLED',
      'the recorder is not installed on this express copy; call installRecorder(<your express>) once at startup',
    );
  }

  const stack = (root as { stack?: unknown[] } | undefined)?.stack;
  if (Array.isArray(stack)) walkStack(ctx, stack, '');

  for (const entry of registry.entries()) {
    if (!ctx.seenIds.has(entry.id)) {
      log.warn('EAD_REGISTRY_ENTRY_NOT_FOUND', entry.method, entry.localPath);
      emit(ctx, entry.method, entry.localPath, [], entry.source, entry.meta);
    }
  }

  return ctx.results;
}

/** Detection never throws (R-1): a fatal walk error degrades to an empty result plus one `warn`. */
export function introspect(
  app: unknown,
  registry: RouteRegistry,
  log: Logger,
  options: IntrospectOptions = {},
): DetectedOperation[] {
  try {
    return introspectUnsafe(app, registry, log, options);
  } catch (err) {
    log.warn('EAD_WALK_FAILED', err instanceof Error ? err.message : String(err));
    return [];
  }
}

export { installRecorder } from './recorder.js';
