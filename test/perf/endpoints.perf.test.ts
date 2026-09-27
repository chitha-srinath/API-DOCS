import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApiDocs } from '../../src/serve/router.js';
import '../../src/auto-record.js';

/** ADR-26: 50 warm-up requests, N=300 samples, nearest-rank p95 < 200 ms in 2 of 3 rounds. */
const BUDGET_MS = 200;
const WARMUP = 50;
const SAMPLES = 300;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

let server: Server;
let base: string;
const api = createApiDocs({ logger: { debug() {}, warn() {} } });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(api.router);
  for (let i = 0; i < 20; i += 1) {
    const router = express.Router();
    for (let j = 0; j < 5; j += 1) {
      router.get(`/items${j}/:id`, (_q, r) => r.end());
      router.post(
        `/typed${j}/:id`,
        ...api.route(
          {
            params: z.object({ id: z.coerce.number() }),
            body: z.object({ name: z.string(), tags: z.array(z.string()) }),
          },
          (req, res) => res.json(req.body),
        ),
      );
    }
    app.use(`/r${i}`, router);
  }
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function measure(send: () => Promise<Response>, before?: () => void): Promise<number> {
  for (let i = 0; i < WARMUP; i += 1) await (await send()).arrayBuffer();
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    before?.();
    const start = performance.now();
    const res = await send();
    await res.arrayBuffer();
    samples.push(performance.now() - start);
    expect(res.status).toBeLessThan(500);
  }
  return p95(samples);
}

async function gate(
  name: string,
  send: () => Promise<Response>,
  before?: () => void,
): Promise<void> {
  const rounds: number[] = [];
  for (let round = 0; round < 3; round += 1) rounds.push(await measure(send, before));
  const breaches = rounds.filter((value) => value >= BUDGET_MS).length;
  console.log(
    `[perf] ${name}: p95 per round = ${rounds.map((v) => v.toFixed(2)).join(' / ')} ms (budget ${BUDGET_MS} ms)`,
  );
  expect(breaches).toBeLessThan(2);
}

describe('p95 latency budget (200 routes)', () => {
  it('B-1 spec endpoint, warm cache', () => gate('spec-warm', () => fetch(`${base}/openapi.json`)));

  it('B-2 spec endpoint, cold (invalidate before each request)', () =>
    gate(
      'spec-cold',
      () => fetch(`${base}/openapi.json`),
      () => api.invalidate(),
    ));

  it('B-3 typed route, valid POST', () =>
    gate('typed-route', () =>
      fetch(`${base}/r7/typed3/42`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'n', tags: ['a', 'b'] }),
      }),
    ));

  it('B-4 docs endpoint', () => gate('docs', () => fetch(`${base}/docs`)));
});
