// ST-005 (S-05), ADR-27a: the version sniff is key-only and never reads
// `app.router` on Express 4 (reading it throws — spike S-4a). Copied verbatim
// from architecture.md "Pinned seams (a)".

export interface AppLike {
  _router?: unknown;
  router?: unknown;
  lazyrouter?: () => void;
  parent?: unknown;
}

export function isExpress4(app: AppLike): boolean {
  return Object.prototype.hasOwnProperty.call(app, '_router') || typeof app.lazyrouter === 'function';
}

export interface SniffResult {
  isV4: boolean;
  root: unknown;
}

/** Never throws (CR-4): the v4 branch never reads `app.router`. */
export function sniffRoot(app: AppLike): SniffResult {
  const isV4 = isExpress4(app);
  if (isV4) {
    app.lazyrouter?.();
    return { isV4, root: app._router };
  }
  return { isV4, root: app.router };
}
