// ST-005 (S-05): a dedicated logger spy per fixture (ADR-29 test-strategy #9).
// Warn assertions filter by the stable `EAD_*` message code.
import { vi } from 'vitest';

import type { Logger } from '../../src/core/types.js';

export interface LoggerSpy extends Logger {
  warns(code?: string): unknown[][];
  debugs(code?: string): unknown[][];
}

export function makeLoggerSpy(): LoggerSpy {
  const debugCalls: unknown[][] = [];
  const warnCalls: unknown[][] = [];

  const debug = vi.fn((code: string, ...args: unknown[]) => {
    debugCalls.push([code, ...args]);
  });
  const warn = vi.fn((code: string, ...args: unknown[]) => {
    warnCalls.push([code, ...args]);
  });

  return {
    debug,
    warn,
    debugs(code?: string): unknown[][] {
      return code === undefined ? debugCalls : debugCalls.filter((call) => call[0] === code);
    },
    warns(code?: string): unknown[][] {
      return code === undefined ? warnCalls : warnCalls.filter((call) => call[0] === code);
    },
  };
}
