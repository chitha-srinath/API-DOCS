import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../src/registry/registry.js';
import type { RouteRegistry } from '../../src/core/types.js';

function noop(): void {}

describe('registry/registry: createRegistry (C12, ADR-17, ADR-27c)', () => {
  it('register returns the input plus id; ids strictly increase; entries() in order', () => {
    const registry = createRegistry();
    const a = registry.register({ method: 'get', localPath: '/a', source: 'typed', meta: {}, handlerFn: noop });
    const b = registry.register({ method: 'post', localPath: '/b', source: 'typed', meta: {}, handlerFn: noop });
    expect(a.id).toBeTypeOf('number');
    expect(b.id).toBeGreaterThan(a.id);
    expect(registry.entries()).toEqual([a, b]);
  });

  it('findByHandle matches validatorFn or handlerFn by identity (toBe)', () => {
    const registry = createRegistry();
    function validatorFn(): void {}
    function handlerFn(): void {}
    const entry = registry.register({
      method: 'get',
      localPath: '/x',
      source: 'typed',
      meta: {},
      validatorFn,
      handlerFn,
    });
    expect(registry.findByHandle(validatorFn)).toBe(entry);
    expect(registry.findByHandle(handlerFn)).toBe(entry);
    expect(registry.findByHandle(() => {})).toBeUndefined();
    expect(registry.findByHandle('not-a-function')).toBeUndefined();
    expect(registry.findByHandle(undefined)).toBeUndefined();
  });

  it('a describe-source entry without validatorFn is found by handlerFn', () => {
    const registry = createRegistry();
    function handlerFn(): void {}
    const entry = registry.register({ method: 'get', localPath: '/y', source: 'describe', meta: {}, handlerFn });
    expect(registry.findByHandle(handlerFn)).toBe(entry);
  });

  it('two registries are isolated', () => {
    const r1 = createRegistry();
    const r2 = createRegistry();
    r1.register({ method: 'get', localPath: '/a', source: 'typed', meta: {}, handlerFn: noop });
    expect(r1.entries()).toHaveLength(1);
    expect(r2.entries()).toHaveLength(0);
  });

  it('mutating the array returned by entries() does not change a later call', () => {
    const registry = createRegistry();
    registry.register({ method: 'get', localPath: '/a', source: 'typed', meta: {}, handlerFn: noop });
    const first = registry.entries();
    (first as unknown as unknown[]).push('intruder');
    expect(registry.entries()).toHaveLength(1);
  });

  it('type conformance: a RouteRegistry can be assigned from createRegistry()', () => {
    const r: RouteRegistry = createRegistry();
    expect(r).toBeDefined();
  });
});
