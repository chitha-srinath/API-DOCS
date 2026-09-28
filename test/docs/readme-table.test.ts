// ST-008 (S-08): parity test between the README Configuration defaults table
// and OPTION_SPEC / DEFAULT_OPTIONS (component C11, AC-029).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { OPTION_SPEC } from '../../src/config/spec-table.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.resolve(here, '../../README.md');

function readReadme(): string {
  return readFileSync(readmePath, 'utf8');
}

interface TableRow {
  key: string;
  defaultText: string;
  description: string;
}

function extractConfigurationSection(readme: string): string {
  const lines = readme.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^#{1,6}\s*Configuration\s*$/i.test(l.trim()));
  if (startIdx === -1) throw new Error('README missing a "Configuration" section');
  const headingLevel = (lines[startIdx]?.match(/^#+/)?.[0] ?? '#').length;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const m = lines[i]?.match(/^(#{1,6})\s/);
    if (m && m[1] && m[1].length <= headingLevel) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

function parseTable(section: string): TableRow[] {
  const rows: TableRow[] = [];
  const lines = section.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const [rawKey, rawDefault, ...rest] = cells;
    if (!rawKey) continue;
    if (/^-+$/.test(rawKey.replace(/[:\s]/g, ''))) continue; // separator row
    if (rawKey.toLowerCase() === 'key') continue; // header row
    const key = rawKey.replace(/`/g, '').trim();
    const defaultText = (rawDefault ?? '').replace(/`/g, '').trim();
    const description = rest.join('|').trim();
    rows.push({ key, defaultText, description });
  }
  return rows;
}

describe('README defaults table parity (AC-029, C11)', () => {
  const readme = readReadme();
  const section = extractConfigurationSection(readme);
  const rows = parseTable(section);
  const rowsByKey = new Map(rows.map((r) => [r.key, r]));
  const specKeys = Object.keys(OPTION_SPEC);

  it('has at least one row', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(specKeys)('has a row for OPTION_SPEC key "%s"', (key) => {
    const row = rowsByKey.get(key);
    expect(row, `README Configuration table is missing a row for key "${key}"`).toBeDefined();
  });

  it('has a schemaAdapter row with default null', () => {
    const row = rowsByKey.get('schemaAdapter');
    expect(row).toBeDefined();
    expect(row?.defaultText).toBe('null');
  });

  it('every row has a non-empty default and description', () => {
    for (const row of rows) {
      expect(row.defaultText.length, `row "${row.key}" has an empty default`).toBeGreaterThan(0);
      expect(row.description.length, `row "${row.key}" has an empty description`).toBeGreaterThan(0);
    }
  });

  it('names no key absent from OPTION_SPEC', () => {
    const specSet = new Set(specKeys);
    for (const row of rows) {
      expect(specSet.has(row.key), `README table row "${row.key}" is not an OPTION_SPEC key`).toBe(true);
    }
  });
});
