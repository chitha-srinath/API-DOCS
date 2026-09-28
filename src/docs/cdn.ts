// ST-007 (S-07, component C8): pinned CDN version constants for the docs UI
// renderers. No UI asset package is a runtime dependency (AC-020) — the HTML
// loads these from a CDN at request time.

export const SCALAR_VERSION = '1.72.1';
export const SWAGGER_UI_VERSION = '5.33.0';

export const SCALAR_CDN_URL = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}`;
export const SWAGGER_UI_JS_CDN_URL = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js`;
export const SWAGGER_UI_CSS_CDN_URL = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css`;
