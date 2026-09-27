/**
 * Side-effect entry: installs the mount recorder on the `express` resolved from this
 * package's location. Imported by the main entry; `express-api-docs/manual` skips it.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { installRecorder } from './introspect/recorder.js';

/**
 * Load `express` relative to this package. Bundlers that turn ESM into CJS drop
 * `import.meta.url`; the bundle's own `require` (or the working directory) is used then.
 */
export function loadExpress(
  metaUrl: string | undefined,
  cjsRequire: ((id: string) => unknown) | undefined,
  cwd: string,
): unknown {
  if (metaUrl) return createRequire(metaUrl)('express');
  if (cjsRequire) return cjsRequire('express');
  return createRequire(join(cwd, 'package.json'))('express');
}

try {
  installRecorder(
    loadExpress(
      import.meta.url as string | undefined,
      typeof require === 'function' ? require : undefined,
      process.cwd(),
    ),
  );
} catch (error) {
  console.warn(
    '[express-api-docs] EAD_RECORDER_AUTO_FAILED: could not install the mount recorder ' +
      `automatically (${String(error)}). Call installRecorder(require("express")) yourself.`,
  );
}
