import { describe, expect, it } from 'vitest';
import { mergeOptions } from '../../src/config/merge.js';

interface OpenApiInfoShape {
  openapi: { info: { title?: string; version?: string } };
}

describe('config/merge: mergeOptions', () => {
  it('AC-044a: global openapi.info.title keeps default info.version', () => {
    const defaults: OpenApiInfoShape = { openapi: { info: { title: 'Default', version: '0.0.0' } } };
    const global: Partial<OpenApiInfoShape> = { openapi: { info: { title: 'Overridden' } } };
    const result = mergeOptions<OpenApiInfoShape>(defaults, global, {});
    expect(result.openapi.info).toEqual({ title: 'Overridden', version: '0.0.0' });
  });

  it("AC-044b: global tags ['a','b'] + route tags ['c'] -> ['c']", () => {
    const defaults: { tags?: string[] } = { tags: [] };
    const global: { tags?: string[] } = { tags: ['a', 'b'] };
    const route: { tags?: string[] } = { tags: ['c'] };
    const result = mergeOptions(defaults, global, route);
    expect(result.tags).toEqual(['c']);
  });

  it('AC-039: route security [] replaces global security', () => {
    const defaults: { security?: unknown[] } = { security: [] };
    const global: { security?: unknown[] } = { security: [{ bearer: [] }] };
    const route: { security?: unknown[] } = { security: [] };
    const result = mergeOptions(defaults, global, route);
    expect(result.security).toEqual([]);
  });

  it('functions replace (operationIdStrategy)', () => {
    const fnA = () => 'a';
    const fnB = () => 'b';
    const defaults: { operationIdStrategy?: () => string } = { operationIdStrategy: fnA };
    const result = mergeOptions(defaults, {}, { operationIdStrategy: fnB });
    expect(result.operationIdStrategy).toBe(fnB);
  });

  it('schemaAdapter object replaces (not deep-merged)', () => {
    interface Adapter {
      isSchema: () => boolean;
      validate?: () => string;
      toJSONSchema?: () => string;
    }
    const globalAdapter: Adapter = { isSchema: () => true, validate: () => 'g', toJSONSchema: () => 'g' };
    const routeAdapter: Adapter = { isSchema: () => false };
    const defaults: { schemaAdapter: Adapter | null } = { schemaAdapter: null };
    const result = mergeOptions(defaults, { schemaAdapter: globalAdapter }, { schemaAdapter: routeAdapter });
    expect(result.schemaAdapter).toBe(routeAdapter);
    expect(result.schemaAdapter).not.toHaveProperty('validate');
  });

  it('primitives replace', () => {
    const defaults: { ui?: 'scalar' | 'swagger-ui' } = { ui: 'scalar' };
    const result = mergeOptions(defaults, { ui: 'swagger-ui' }, {});
    expect(result.ui).toBe('swagger-ui');
  });

  it('inputs are not mutated', () => {
    const defaults: OpenApiInfoShape = { openapi: { info: { title: 'Default', version: '0.0.0' } } };
    const global: Partial<OpenApiInfoShape> = { openapi: { info: { title: 'Overridden' } } };
    const defaultsSnapshot = JSON.parse(JSON.stringify(defaults));
    const globalSnapshot = JSON.parse(JSON.stringify(global));
    mergeOptions(defaults, global, {});
    expect(defaults).toEqual(defaultsSnapshot);
    expect(global).toEqual(globalSnapshot);
  });

  it('undefined does not override', () => {
    const defaults: { ui?: string } = { ui: 'scalar' };
    const result = mergeOptions(defaults, { ui: undefined }, {});
    expect(result.ui).toBe('scalar');
  });
});
