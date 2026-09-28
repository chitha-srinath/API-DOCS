// ST-007 (S-07, component C9): the composition root. `createApiDocs(opts)`
// validates synchronously before building anything, then builds the Router
// (spec and docs GETs, gated by `serveSpec`/`serveDocs`), resolves the app
// lazily through `req.app`, and wires the cache. Per ADR-38, the default
// adapter (`standardSchemaAdapter`) is injected here, never in `src/config/**`.
import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';

import { memoizeAdapter } from '../adapter/memo.js';
import { standardSchemaAdapter } from '../adapter/standard.js';
import type { SchemaAdapter } from '../adapter/types.js';
import { DEFAULT_OPTIONS } from '../config/defaults.js';
import { mergeOptions } from '../config/merge.js';
import type { ApiDocsOptions } from '../config/types.js';
import { validateOptions } from '../config/validate.js';
import { renderDocsHtml } from '../docs/render.js';
import { introspect } from '../introspect/index.js';
import { noopLogger } from '../introspect/recorder.js';
import { createRegistry } from '../registry/registry.js';
import type { DescribeFn } from '../route/describe.js';
import { createDescribe } from '../route/describe.js';
import type { RouteFn } from '../route/typed.js';
import { createRoute } from '../route/typed.js';
import type { OpenApiDocument, SpecOperation } from '../spec/build.js';
import { buildSpec, specOperationsFromRegistry } from '../spec/build.js';
import { createSpecCache } from '../spec/cache.js';

export interface GetSpecContext {
  readonly app?: unknown;
}

export interface ApiDocsInstance {
  readonly router: ExpressRouter;
  readonly route: RouteFn;
  readonly describe: DescribeFn;
  readonly options: ApiDocsOptions;
  getSpec(ctx?: GetSpecContext): OpenApiDocument;
  invalidate(): void;
}

/**
 * Validates synchronously before building anything (AC-045, AC-043). Zero
 * options resolves to a config that deep-equals `DEFAULT_OPTIONS`, including
 * `schemaAdapter: null` (AC-036) — the default adapter used at runtime is
 * `standardSchemaAdapter`, injected below, without mutating `options`.
 */
export function createApiDocs(rawOptions?: unknown): ApiDocsInstance {
  const validated = validateOptions(rawOptions);
  const options = mergeOptions(DEFAULT_OPTIONS as ApiDocsOptions, validated, {}) as ApiDocsOptions;

  const logger = noopLogger;

  const resolvedAdapter: SchemaAdapter<unknown> =
    (options.schemaAdapter as SchemaAdapter<unknown> | null | undefined) ??
    (standardSchemaAdapter as unknown as SchemaAdapter<unknown>);
  // ADR-03 (F-04 fix): wrap the resolved adapter in `memoizeAdapter` before it's used to
  // build the spec, so repeated `toJSONSchema` calls for the same schema identity across
  // multiple spec rebuilds are cached, not re-derived from scratch.
  const adapter: SchemaAdapter<unknown> = memoizeAdapter(resolvedAdapter, logger);

  const registry = createRegistry();
  const cache = createSpecCache<OpenApiDocument>();

  const route = createRoute({ registry, options, logger });
  const describe = createDescribe({ registry });

  const specPath = options.specPath as string;
  const docsPath = options.docsPath as string;

  function buildFromApp(app: unknown): OpenApiDocument {
    const ops = introspect(app, registry, logger, {
      autoDetect: options.autoDetect !== false,
      ownPaths: [specPath, docsPath],
    });
    return buildSpec(ops, options, adapter);
  }

  function getSpec(ctx?: GetSpecContext): OpenApiDocument {
    if (ctx?.app !== undefined) {
      return cache.get(ctx.app, () => buildFromApp(ctx.app));
    }
    const ops: SpecOperation[] = specOperationsFromRegistry(registry);
    return buildSpec(ops, options, adapter);
  }

  const router: ExpressRouter = Router();

  if (options.serveSpec) {
    router.get(specPath, (req: Request, res: Response) => {
      res.json(getSpec({ app: req.app }));
    });
  }

  if (options.serveDocs) {
    router.get(docsPath, (req: Request, res: Response) => {
      const specUrl = options.docs?.specUrl ?? specPath;
      const html = renderDocsHtml({
        specUrl,
        ui: (options.ui as 'scalar' | 'swagger-ui') ?? 'scalar',
        cdnUrl: options.cdnUrl,
      });
      res.type('html').send(html);
    });
  }

  return {
    router,
    route,
    describe,
    options,
    getSpec,
    invalidate(): void {
      cache.invalidate();
    },
  };
}
