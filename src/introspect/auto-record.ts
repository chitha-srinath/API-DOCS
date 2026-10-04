// ST-005 (S-05), ADR-23: default install. Resolves `express` from the
// package's own location (`createRequire(import.meta.url)`) and calls
// `installRecorder()` on it. A resolution failure is swallowed with one
// `warn`. `resolve`/`log` are injectable for tests; production use relies on
// the defaults.
import { createRequire } from 'node:module';

import type { Logger } from '../core/types.js';
import { installRecorder } from './recorder.js';

const requireFromHere = createRequire(import.meta.url);

const consoleWarnLogger: Logger = {
  debug(): void {
    /* auto-record install is not chatty at debug level */
  },
  warn(code: string, ...args: unknown[]): void {
    console.warn(`[express-api-contract] ${code}`, ...args);
  },
};

export function autoRecord(
  resolve: (id: string) => unknown = (id) => requireFromHere(id),
  log: Logger = consoleWarnLogger,
): void {
  try {
    const express = resolve('express');
    installRecorder(express, log);
  } catch (err) {
    log.warn('EAD_AUTO_RECORD_RESOLUTION_FAILED', err instanceof Error ? err.message : String(err));
  }
}

autoRecord();
