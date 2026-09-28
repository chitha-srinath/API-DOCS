import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface MajorEntry {
  major: 4 | 5;
  express: unknown;
  alias: 'express' | 'express4';
}

function versionOf(alias: string): string {
  const pkg = require(`${alias}/package.json`) as { version: string };
  return pkg.version;
}

function majorOf(version: string): 4 | 5 {
  const n = Number(version.split('.')[0]);
  if (n !== 4 && n !== 5) {
    throw new Error(`unsupported express major: ${version}`);
  }
  return n;
}

const candidates: Array<{ alias: 'express' | 'express4' }> = [{ alias: 'express' }, { alias: 'express4' }];

const seen = new Set<number>();
export const majors: MajorEntry[] = [];

for (const { alias } of candidates) {
  let version: string;
  try {
    version = versionOf(alias);
  } catch {
    continue;
  }
  const major = majorOf(version);
  if (seen.has(major)) continue;
  seen.add(major);
  majors.push({ major, express: require(alias), alias });
}
