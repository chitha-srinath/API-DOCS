import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8');

describe('CI workflow (AC-027)', () => {
  const ci = read('ci.yml');

  it('runs on push and pull_request', () => {
    expect(ci).toMatch(/^on:\n {2}push:[\s\S]*^ {2}pull_request:/m);
  });

  it('matrix is node 22/24 x express 4/5', () => {
    expect(ci).toContain('node: [22, 24]');
    expect(ci).toContain('express: [4, 5]');
    expect(ci).toContain('node-version: ${{ matrix.node }}');
  });

  it('the express install step uses the matrix value (ADR-25)', () => {
    expect(ci).toContain('npm i --no-save express@${{ matrix.express }}');
  });

  it('runs build, lint, typecheck and tests', () => {
    for (const step of ['npm run build', 'npm run lint', 'npx tsc --noEmit', 'npm test'])
      expect(ci).toContain(step);
  });

  it('has peer-floor and perf jobs', () => {
    expect(ci).toContain('express@4.21.0');
    expect(ci).toContain('express@5.0.0');
    expect(ci).toContain('npm run perf');
  });
});

describe('release workflow (AC-028)', () => {
  it('is triggered only by workflow_dispatch', () => {
    const release = read('release.yml');
    const on = release.slice(release.indexOf('\non:'), release.indexOf('\npermissions:'));
    expect(on).toContain('workflow_dispatch');
    expect(on).not.toMatch(/\bpush\b|\btags?\b|\brelease\b|schedule/);
  });

  it('no other workflow publishes', () => {
    expect(read('ci.yml')).not.toContain('npm publish');
  });
});
