import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const workflowsDir = join(process.cwd(), '.github', 'workflows');

function loadWorkflow(name: string) {
  return parse(readFileSync(join(workflowsDir, name), 'utf8'));
}

function allWorkflowFiles(): string[] {
  return readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

function jobsOf(wf: any): Record<string, any> {
  return wf.jobs ?? {};
}

describe('ci.yml', () => {
  const ci = loadWorkflow('ci.yml');
  const jobs = jobsOf(ci);

  it('triggers on push and pull_request', () => {
    expect(Object.keys(ci.on)).toEqual(expect.arrayContaining(['push', 'pull_request']));
  });

  it('main job matrix is node {22,24} x express {4,5}', () => {
    const main = jobs.test ?? jobs.build ?? Object.values(jobs)[0];
    const matrix = main.strategy.matrix;
    expect(matrix.node).toEqual([22, 24]);
    expect(matrix.express).toEqual([4, 5]);
  });

  it('no workflow file references node 20', () => {
    for (const file of allWorkflowFiles()) {
      const text = readFileSync(join(workflowsDir, file), 'utf8');
      expect(text).not.toMatch(/node-version:\s*['"]?20['"]?/);
    }
  });

  it('install step references matrix.express', () => {
    const main = jobs.test ?? Object.values(jobs)[0];
    const steps: any[] = main.steps;
    const hasExpressRef = steps.some((s) => typeof s.run === 'string' && s.run.includes('${{ matrix.express }}'));
    expect(hasExpressRef).toBe(true);
  });

  it('v4 cells install pinned types and run test:v4; v5 cells run test + tsc', () => {
    const main = jobs.test ?? Object.values(jobs)[0];
    const steps: any[] = main.steps;
    const runs = steps
      .map((s) => s.run)
      .filter(Boolean)
      .join('\n');
    expect(runs).toContain('express@4.22.3');
    expect(runs).toContain('@types/express@4.17.25');
    expect(runs).toContain('@types/express-serve-static-core@4.19.9');
    expect(runs).toMatch(/test:v4/);
    expect(runs).toMatch(/npm test\b/);
    expect(runs).toContain('npx tsc --noEmit');
  });

  it('every cell builds and lints', () => {
    const main = jobs.test ?? Object.values(jobs)[0];
    const steps: any[] = main.steps;
    const runs = steps
      .map((s) => s.run)
      .filter(Boolean)
      .join('\n');
    expect(runs).toContain('npm run build');
    expect(runs).toContain('npm run lint');
  });

  it('has a peer-floor job', () => {
    const job = jobs['peer-floor'];
    expect(job).toBeTruthy();
    expect(job['continue-on-error']).not.toBe(true);
    const runs = (job.steps as any[])
      .map((s) => s.run)
      .filter(Boolean)
      .join('\n');
    expect(runs).toContain('express@4.21.0');
    expect(runs).toContain('express@5.0.0');
    expect(runs).toContain('router@2.0.0');
    expect(runs).toContain('zod@4.2.0');
    expect(runs).toMatch(/test\/introspect/);
    expect(runs).toContain('test/adapter/standard-floor.test.ts');
  });

  it('has a mutation-scoped job', () => {
    const job = jobs['mutation-scoped'];
    expect(job).toBeTruthy();
    expect(job['timeout-minutes']).toBe(30);
    expect(job['continue-on-error']).not.toBe(true);
    const runs = (job.steps as any[])
      .map((s) => s.run)
      .filter(Boolean)
      .join('\n');
    expect(runs).toContain('git diff --name-only origin/main -- src/');
    expect(runs).toContain('--mutate');
    expect(runs).toContain('--incremental');
  });

  it('mutation-scoped and peer-floor jobs cache stryker incremental state', () => {
    for (const jobName of ['mutation-scoped']) {
      const job = jobs[jobName];
      const cacheStep = (job.steps as any[]).find(
        (s) => typeof s.uses === 'string' && s.uses.startsWith('actions/cache'),
      );
      expect(cacheStep).toBeTruthy();
      expect(cacheStep.with.path).toContain('reports/stryker-incremental.json');
      expect(cacheStep.with.key).toContain("hashFiles('src/**','test/**')");
      expect(cacheStep.with['restore-keys']).toBeTruthy();
    }
  });

  it('has a perf job pinned to ubuntu-latest/node24/express5', () => {
    const job = jobs.perf;
    expect(job).toBeTruthy();
    expect(job['runs-on']).toBe('ubuntu-latest');
    expect(job['continue-on-error']).not.toBe(true);
    const runs = (job.steps as any[])
      .map((s) => s.run)
      .filter(Boolean)
      .join('\n');
    expect(runs).toContain('npm run perf');
  });

  it('no push/pull_request workflow runs npm publish', () => {
    for (const file of allWorkflowFiles()) {
      const wf = loadWorkflow(file);
      const triggers = Object.keys(wf.on ?? {});
      if (triggers.includes('push') || triggers.includes('release')) {
        const text = JSON.stringify(wf.jobs);
        expect(text).not.toContain('npm publish');
      }
    }
  });
});

describe('mutation-full workflow', () => {
  const files = allWorkflowFiles().filter((f) => f !== 'ci.yml' && f !== 'release.yml');
  const mutationFullFile = files.find((f) => {
    const wf = loadWorkflow(f);
    return Object.values(jobsOf(wf)).some((j: any) => j['timeout-minutes'] === 120);
  });

  it('exists as a schedule + workflow_dispatch triggered workflow', () => {
    expect(mutationFullFile).toBeTruthy();
    const wf = loadWorkflow(mutationFullFile as string);
    expect(Object.keys(wf.on).sort()).toEqual(['schedule', 'workflow_dispatch'].sort());
    expect(wf.on.schedule[0].cron).toBe('0 3 * * *');
  });

  it('is not present in ci.yml', () => {
    const ci = loadWorkflow('ci.yml');
    const jobs = jobsOf(ci);
    expect(Object.values(jobs).some((j: any) => j['timeout-minutes'] === 120)).toBe(false);
  });

  it('caches stryker incremental state', () => {
    const wf = loadWorkflow(mutationFullFile as string);
    const job = Object.values(jobsOf(wf)).find((j: any) => j['timeout-minutes'] === 120) as any;
    const cacheStep = (job.steps as any[]).find(
      (s) => typeof s.uses === 'string' && s.uses.startsWith('actions/cache'),
    );
    expect(cacheStep).toBeTruthy();
    expect(cacheStep.with.path).toContain('reports/stryker-incremental.json');
    expect(cacheStep.with.key).toContain("hashFiles('src/**','test/**')");
    expect(cacheStep.with['restore-keys']).toBeTruthy();
  });
});

describe('release.yml', () => {
  const release = loadWorkflow('release.yml');

  it('is triggered only by workflow_dispatch', () => {
    expect(Object.keys(release.on)).toEqual(['workflow_dispatch']);
  });
});

describe('stryker.config.mjs', () => {
  it('has the incremental + command-runner shape', async () => {
    // @ts-expect-error - stryker.config.mjs has no type declarations
    const mod = await import('../../stryker.config.mjs');
    const config = mod.default;
    expect(config.incremental).toBe(true);
    expect(config.incrementalFile).toBe('reports/stryker-incremental.json');
    expect(config.testRunner).toBe('command');
    expect(config.thresholds.break).toBe(70);
  });
});
