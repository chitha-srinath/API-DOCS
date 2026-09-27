import { createRequire } from 'node:module';
import type { Express } from 'express';
import '../../src/auto-record.js';
import { installRecorder } from '../../src/introspect/recorder.js';

const require = createRequire(import.meta.url);

export interface ExpressModule {
  (): Express;
  Router: typeof import('express').Router;
  json: typeof import('express').json;
  application: unknown;
  response: typeof import('express').response;
}

export interface Major {
  major: 4 | 5;
  name: string;
  express: ExpressModule;
}

function load(name: string): Major {
  const express = require(name) as ExpressModule;
  const version = (require(`${name}/package.json`) as { version: string }).version;
  return { major: Number(version.split('.')[0]) as 4 | 5, name, express };
}

// The root `express` copy gets the recorder through the package's auto-record entry;
// the `express4` alias is a second copy, so it gets the documented explicit call.
const loaded = [load('express'), load('express4')];
installRecorder(loaded[1]!.express);

/** Installed Express copies, deduped by major (ADR-25). */
export const majors: Major[] = loaded.filter(
  (entry, index) => loaded.findIndex((other) => other.major === entry.major) === index,
);

export function spyLogger() {
  const calls: Array<{ level: 'debug' | 'warn'; message: string; code?: string }> = [];
  return {
    calls,
    debug(message: string, details?: { code: string }) {
      calls.push({ level: 'debug', message, code: details?.code });
    },
    warn(message: string, details?: { code: string }) {
      calls.push({ level: 'warn', message, code: details?.code });
    },
    count(level: 'debug' | 'warn', code?: string) {
      return calls.filter((c) => c.level === level && (code === undefined || c.code === code))
        .length;
    },
  };
}
