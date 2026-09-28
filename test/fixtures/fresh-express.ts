import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const PRIVATE_DEPS = ['router', 'path-to-regexp'];

export interface FreshExpressResult {
  express: unknown;
  restore: () => void;
}

function packageRoot(alias: string): string {
  return dirname(require.resolve(`${alias}/package.json`));
}

function collectCacheKeysUnder(root: string): string[] {
  return Object.keys(require.cache).filter((key) => key.startsWith(root));
}

export function freshExpress(alias: 'express' | 'express4'): FreshExpressResult {
  const roots = [packageRoot(alias)];
  for (const dep of PRIVATE_DEPS) {
    try {
      roots.push(packageRoot(join(alias, '..', dep)));
    } catch {
      try {
        roots.push(packageRoot(dep));
      } catch {
        // dependency not resolvable independently; skip.
      }
    }
  }

  const saved = new Map<string, NodeJS.Module | undefined>();
  for (const root of roots) {
    for (const key of collectCacheKeysUnder(root)) {
      saved.set(key, require.cache[key]);
      delete require.cache[key];
    }
  }

  const express = require(alias);

  const restore = (): void => {
    for (const root of roots) {
      for (const key of collectCacheKeysUnder(root)) {
        delete require.cache[key];
      }
    }
    for (const [key, mod] of saved) {
      if (mod) require.cache[key] = mod;
    }
  };

  return { express, restore };
}
