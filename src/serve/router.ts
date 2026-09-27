import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { memoizeAdapter } from '../adapter/memo.js';
import { standardSchemaAdapter } from '../adapter/standard.js';
import type { SchemaAdapter } from '../adapter/types.js';
import { freezeResolved, type DeepReadonly } from '../config/defaults.js';
import type { ApiDocsOptions, ResolvedOptions } from '../config/types.js';
import { resolveOptions } from '../config/validate.js';
import type { Logger } from '../core/types.js';
import { renderDocs } from '../docs/render.js';
import { fingerprint, introspect, markInternal, topApp } from '../introspect/index.js';
import { isExpress4, type AppLike } from '../introspect/recorder.js';
import { createRegistry } from '../registry/registry.js';
import { createDescribe } from '../route/describe.js';
import { createRoute } from '../route/typed.js';
import { buildSpec, type OpenApiDocument } from '../spec/build.js';
import { SpecCache } from '../spec/cache.js';

export interface GetSpecOptions {
  /** The Express app to walk. Defaults to the app seen by the last spec/docs request. */
  app?: unknown;
}

export interface ApiDocs {
  /** Middleware serving the spec and docs endpoints: `app.use(api.router)`. */
  readonly router: RequestHandler;
  /** Typed route helper: `router.post('/users', ...api.route({ body }, handler))`. */
  readonly route: ReturnType<typeof createRoute>;
  /** Docs-only metadata for a plain route: `router.get('/x', api.describe({...}), handler)`. */
  readonly describe: ReturnType<typeof createDescribe>;
  /** The OpenAPI 3.1 document (a copy). Walks `app` when given or already seen. */
  getSpec(options?: GetSpecOptions): OpenApiDocument;
  /** Drop the cached spec, e.g. after replacing a route in place. */
  invalidate(): void;
  /** The resolved, deep-frozen configuration. */
  readonly options: DeepReadonly<ResolvedOptions>;
}

const consoleLogger: Logger = {
  debug() {},
  warn(message, details) {
    console.warn(`[express-api-docs] ${details?.code ? `${details.code}: ` : ''}${message}`);
  },
};

function samePath(requestPath: string, configured: string): boolean {
  const normalized = requestPath.length > 1 ? requestPath.replace(/\/+$/, '') : requestPath;
  return normalized.toLowerCase() === configured.toLowerCase();
}

/**
 * Create one API docs instance. Options are validated synchronously: an unknown key or
 * invalid value throws `ApiDocsConfigError` before anything is built.
 */
export function createApiDocs(options?: ApiDocsOptions): ApiDocs {
  const resolved = resolveOptions(options);
  const frozen = freezeResolved(resolved);
  const logger: Logger = resolved.logger ?? consoleLogger;
  const adapter = memoizeAdapter(
    (resolved.adapter as SchemaAdapter | null) ?? standardSchemaAdapter,
  );
  const registry = createRegistry();
  const cache = new SpecCache<{ doc: OpenApiDocument; json: string }>();
  let lastApp: AppLike | undefined;

  const compute = (app: AppLike | undefined): { doc: OpenApiDocument; json: string } => {
    const top = app ? topApp(app, logger) : undefined;
    const key = `${top ? fingerprint(top) : 'none'}:${registry.entries().length}`;
    return cache.get(key, () => {
      const walked = introspect(top, registry, logger);
      const doc = buildSpec({
        operations: walked.operations,
        unlocated: walked.unlocated,
        walked: top !== undefined,
        major: top && isExpress4(top) ? 4 : 5,
        options: resolved,
        adapter,
        logger,
      });
      return { doc, json: JSON.stringify(doc) };
    });
  };

  const handleSpec = (req: Request, res: Response): void => {
    lastApp = req.app as unknown as AppLike;
    const { json } = compute(lastApp);
    res.status(200).type('application/json').send(json);
  };

  const handleDocs = (req: Request, res: Response): void => {
    lastApp = req.app as unknown as AppLike;
    const specUrl = resolved.docs.specUrl ?? `${req.baseUrl}${resolved.specPath}`;
    const html = renderDocs({
      ui: resolved.ui,
      specUrl,
      title: resolved.docs.title ?? resolved.openapi.info.title,
      cdnUrl: resolved.cdnUrl,
    });
    res.status(200).type('html').send(html);
  };

  const router: RequestHandler = function apiDocsRouter(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    try {
      if (resolved.serveSpec && samePath(req.path, resolved.specPath)) handleSpec(req, res);
      else if (resolved.serveDocs && samePath(req.path, resolved.docsPath)) handleDocs(req, res);
      else next();
    } catch (error) {
      next(error);
    }
  };
  markInternal(router);

  return {
    router,
    route: createRoute({ registry, adapter, logger, options: resolved }),
    describe: createDescribe(registry),
    getSpec(getOptions?: GetSpecOptions): OpenApiDocument {
      const app = (getOptions?.app as AppLike | undefined) ?? lastApp;
      return JSON.parse(compute(app).json) as OpenApiDocument;
    },
    invalidate(): void {
      cache.invalidate();
    },
    options: frozen,
  };
}
