import { describe, expect, it } from 'vitest';
import type { RequestHandler } from 'express';
import { META, type RouteRegistry } from '../../src/core/types.js';
import { Registry, createRegistry } from '../../src/registry/registry.js';
import { createRoute } from '../../src/route/typed.js';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { resolveOptions } from '../../src/config/validate.js';
import { z } from 'zod';

const fn = (): RequestHandler => () => undefined;

describe('Registry (ADR-17, ADR-27c)', () => {
  it('register returns the entry with an id', () => {
    const registry = createRegistry();
    const validatorFn = fn();
    const handlerFn = fn();
    const entry = registry.register({
      method: 'get',
      localPath: '/a',
      source: 'typed',
      meta: { summary: 's' },
      validatorFn,
      handlerFn,
    });
    expect(entry).toEqual({
      id: 1,
      method: 'get',
      localPath: '/a',
      source: 'typed',
      meta: { summary: 's' },
      validatorFn,
      handlerFn,
    });
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('ids follow registration order', () => {
    const registry = createRegistry();
    const ids = [1, 2, 3].map(
      () => registry.register({ source: 'describe', meta: {}, handlerFn: fn() }).id,
    );
    expect(ids).toEqual([1, 2, 3]);
    expect(registry.entries().map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('findByHandle matches validatorFn or handlerFn by identity', () => {
    const registry = createRegistry();
    const validatorFn = fn();
    const handlerFn = fn();
    const entry = registry.register({ source: 'typed', meta: {}, validatorFn, handlerFn });
    expect(registry.findByHandle(validatorFn)).toBe(entry);
    expect(registry.findByHandle(handlerFn)).toBe(entry);
    expect(registry.findByHandle(fn())).toBeUndefined();
    expect(registry.findByHandle('x')).toBeUndefined();
  });

  it('describe entries without validatorFn are found by handlerFn', () => {
    const registry = createRegistry();
    const handlerFn = fn();
    const entry = registry.register({ source: 'describe', meta: {}, handlerFn });
    expect(registry.findByHandle(handlerFn)).toBe(entry);
  });

  it('instances are isolated and entries() is a copy', () => {
    const a = new Registry();
    const b: RouteRegistry = createRegistry();
    a.register({ source: 'describe', meta: {}, handlerFn: fn() });
    expect(b.entries()).toHaveLength(0);
    const list = a.entries() as unknown[];
    list.pop();
    expect(a.entries()).toHaveLength(1);
  });

  it('route() registers at declaration and tags both handlers', () => {
    const registry = createRegistry();
    const route = createRoute({
      registry,
      adapter: standardSchemaAdapter,
      logger: { debug() {}, warn() {} },
      options: resolveOptions(),
    });
    const [validator, handler] = route(
      { method: 'post', path: '/u', body: z.object({}) },
      () => undefined,
    );
    const entries = registry.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('typed');
    expect(entries[0]!.method).toBe('post');
    expect(entries[0]!.localPath).toBe('/u');
    expect(entries[0]!.validatorFn).toBe(validator);
    expect(entries[0]!.handlerFn).toBe(handler);
    expect((handler as any)[META]).toEqual({ source: 'typed', meta: entries[0]!.meta });
    expect((validator as any)[META]).toBe((handler as any)[META]);
    expect(META).toBe(Symbol.for('express-api-docs.meta'));
  });
});
