// ST-007 (S-07), ADR-26: shared perf harness. 50 warm-up requests via an
// in-process http.Server and supertest, then N=300 timed samples; p95 by
// nearest-rank. A scenario fails only if p95 exceeds the budget in 2 of 3
// consecutive rounds (noise policy).
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { Application } from 'express';

const WARM_UPS = 50;
const SAMPLES = 300;
const BUDGET_MS = 200;
const ROUNDS = 3;
const FAILURES_TO_FAIL = 2;

function nearestRankP95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length);
  return sorted[Math.max(0, rank - 1)] as number;
}

async function timedRound(
  server: Server,
  requestFn: (agent: ReturnType<typeof request>) => Promise<unknown>,
): Promise<number> {
  const agent = request(server);
  for (let i = 0; i < WARM_UPS; i += 1) {
    await requestFn(agent);
  }
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const start = performance.now();
    await requestFn(agent);
    samples.push(performance.now() - start);
  }
  return nearestRankP95(samples);
}

export async function assertPerfBudget(
  app: Application,
  requestFn: (agent: ReturnType<typeof request>) => Promise<unknown>,
  label: string,
): Promise<void> {
  const server = createServer(app);
  let failures = 0;
  const p95s: number[] = [];
  try {
    for (let round = 0; round < ROUNDS; round += 1) {
      const p95 = await timedRound(server, requestFn);
      p95s.push(p95);
      if (p95 >= BUDGET_MS) failures += 1;
      if (failures < FAILURES_TO_FAIL && round === ROUNDS - 1) break;
    }
  } finally {
    server.close();
  }
  console.log(`[perf] ${label} p95 rounds (ms): ${p95s.map((n) => n.toFixed(2)).join(', ')}`);
  if (failures >= FAILURES_TO_FAIL) {
    throw new Error(`${label}: p95 exceeded ${BUDGET_MS}ms in ${failures}/${p95s.length} rounds: ${p95s.join(', ')}`);
  }
}
