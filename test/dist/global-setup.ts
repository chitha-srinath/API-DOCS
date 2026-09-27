import { execSync } from 'node:child_process';

/** Build once per test run so dist tests never read a stale build (ADR-29 #5). */
export default function setup(): void {
  execSync('npm run build', { stdio: 'pipe' });
}
