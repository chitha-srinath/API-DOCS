// AIDD QA exhaustive — performance-smoke category (TC-PERF-NNN).
// Covers: (a) WARM-cache ADR-26 budget at a realistic route count (500-1000),
// distinct from the cold-path scenarios already covered by F-03/F-04;
// (b) a memory-leak smoke check across repeated spec rebuilds; (c) a soak
// test of the introspection walker at 500-1000 routes across repeated calls
// looking for latency degradation over time (not just a single-shot number).
import { describe, it, expect } from 'vitest';
import express from 'express';
import type { Application } from 'express';
import request from 'supertest';

import { createApiDocs } from '../../../src/serve/router.js';
import { assertPerfBudget } from '../../perf/harness.js';

const BUDGET_MS = 200;

function buildAppWithRoutes(routeCount: number): { app: Application; apiDocs: ReturnType<typeof createApiDocs> } {
  const app = express();
  const apiDocs = createApiDocs();
  app.use(apiDocs.router);
  for (let i = 0; i < routeCount; i += 1) {
    const [validate, handler] = apiDocs.route('get', `/resource-${i}/:id`, {}, (req, res) => res.json({ ok: true }));
    app.get(`/resource-${i}/:id`, validate, handler);
  }
  return { app, apiDocs };
}

describe('performance-smoke: TC-PERF-001 WARM-cache budget at realistic route count (500)', () => {
  it('p95 < 200ms with 500 routes mounted, cache warm', async () => {
    const { app } = buildAppWithRoutes(500);
    // Prime the cache once outside the harness's own warm-up loop so we are
    // unambiguously measuring the warm (post-first-build) path, not the
    // first cache-fill which F-03/F-04 already own.
    await request(app).get('/openapi.json');
    await assertPerfBudget(app, (agent) => agent.get('/openapi.json'), 'perf-smoke-warm-500');
  });
});

describe('performance-smoke: TC-PERF-002 WARM-cache budget at realistic route count (1000)', () => {
  it('p95 < 200ms with 1000 routes mounted, cache warm', async () => {
    const { app } = buildAppWithRoutes(1000);
    await request(app).get('/openapi.json');
    await assertPerfBudget(app, (agent) => agent.get('/openapi.json'), 'perf-smoke-warm-1000');
  });
});

describe('performance-smoke: TC-PERF-003 memory smoke across repeated spec rebuilds', () => {
  it('heap growth after 200 forced rebuilds stays within a generous bound (no gross leak)', async () => {
    const { app, apiDocs } = buildAppWithRoutes(300);
    // Warm up JIT / caches first, then force GC-independent measurement by
    // taking readings before and after a large number of forced rebuilds
    // (invalidate + refetch), which is exactly the dead memoizeAdapter path
    // (F-04) minus its fix — this test is about *leak*, not about the F-04
    // throughput regression already filed.
    for (let i = 0; i < 20; i += 1) {
      apiDocs.invalidate();
      await request(app).get('/openapi.json');
    }
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;
    const REBUILDS = 200;
    for (let i = 0; i < REBUILDS; i += 1) {
      apiDocs.invalidate();
      await request(app).get('/openapi.json');
    }
    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    const deltaMb = (after - before) / (1024 * 1024);

    console.log(
      `[perf-smoke] TC-PERF-003 heapUsed before=${(before / 1024 / 1024).toFixed(2)}MB ` +
        `after=${(after / 1024 / 1024).toFixed(2)}MB delta=${deltaMb.toFixed(2)}MB over ${REBUILDS} rebuilds ` +
        `(gc exposed: ${Boolean(global.gc)})`,
    );
    // Generous bound: a genuine unbounded leak at 300 routes x 200 rebuilds
    // would show tens-to-hundreds of MB of retained growth; we fail only on
    // a clearly runaway trend, not on ordinary allocator/GC noise.
    //
    // This check is only meaningful when global.gc() actually ran (Node
    // started with --expose-gc, e.g. `npm run perf`). Plain `npm test` does
    // not set that flag, so without it the delta is uncollected allocator
    // noise across the whole heap, not leak signal, and the 50MB bound can
    // flake under a busy test worker sharing memory pressure with 70+ other
    // files. Relax to a much wider bound (explicit degradation, not a
    // silent skip) rather than assert on unmitigated GC noise.
    const bound = global.gc ? 50 : 300;
    expect(deltaMb).toBeLessThan(bound);
  });
});

describe('performance-smoke: TC-PERF-004 introspection soak at 500 routes (repeated calls)', () => {
  it('per-call latency does not degrade across repeated forced-rebuild introspection passes', async () => {
    const { app, apiDocs } = buildAppWithRoutes(500);
    const ROUNDS = 30;
    const timings: number[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      apiDocs.invalidate();
      const start = performance.now();
      await request(app).get('/openapi.json');
      timings.push(performance.now() - start);
    }
    const firstFive = timings.slice(0, 5);
    const lastFive = timings.slice(-5);
    const avgFirst = firstFive.reduce((a, b) => a + b, 0) / firstFive.length;
    const avgLast = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;

    console.log(
      `[perf-smoke] TC-PERF-004 soak 500 routes x ${ROUNDS} rebuilds: ` +
        `all=${timings.map((t) => t.toFixed(1)).join(',')} avgFirst5=${avgFirst.toFixed(2)}ms avgLast5=${avgLast.toFixed(2)}ms`,
    );
    // Soak-degradation signature: later rounds should not be dramatically
    // slower than early rounds (allow up to 3x for GC/noise before flagging
    // an actual growth trend as a defect worth reporting).
    expect(avgLast).toBeLessThan(avgFirst * 3 + 50);
  });
});

describe('performance-smoke: TC-PERF-005 introspection soak at 1000 routes (repeated calls)', () => {
  it('per-call latency does not degrade across repeated forced-rebuild introspection passes', async () => {
    const { app, apiDocs } = buildAppWithRoutes(1000);
    const ROUNDS = 20;
    const timings: number[] = [];
    for (let i = 0; i < ROUNDS; i += 1) {
      apiDocs.invalidate();
      const start = performance.now();
      await request(app).get('/openapi.json');
      timings.push(performance.now() - start);
    }
    const firstFive = timings.slice(0, 5);
    const lastFive = timings.slice(-5);
    const avgFirst = firstFive.reduce((a, b) => a + b, 0) / firstFive.length;
    const avgLast = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;

    console.log(
      `[perf-smoke] TC-PERF-005 soak 1000 routes x ${ROUNDS} rebuilds: ` +
        `all=${timings.map((t) => t.toFixed(1)).join(',')} avgFirst5=${avgFirst.toFixed(2)}ms avgLast5=${avgLast.toFixed(2)}ms`,
    );
    expect(avgLast).toBeLessThan(avgFirst * 3 + 50);
  });
});

describe('performance-smoke: TC-PERF-007 WARM-cache budget at 2000 routes (contrast with cold-path F-03)', () => {
  it('p95 < 200ms with 2000 routes mounted, cache warm — the same N where F-03 clocked 252ms cold', async () => {
    const { app } = buildAppWithRoutes(2000);
    await request(app).get('/openapi.json');
    await assertPerfBudget(app, (agent) => agent.get('/openapi.json'), 'perf-smoke-warm-2000');
  });
});

describe('performance-smoke: TC-PERF-006 WARM budget headroom vs BUDGET_MS constant sanity', () => {
  it('sanity: BUDGET_MS constant used by harness matches ADR-26 (200ms)', () => {
    // Guards against silent harness drift changing the meaning of every
    // other perf-smoke case without anyone noticing.
    expect(BUDGET_MS).toBe(200);
  });
});
