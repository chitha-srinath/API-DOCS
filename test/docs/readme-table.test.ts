import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPTION_SPEC } from '../../src/config/spec-table.js';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

describe('README (AC-029)', () => {
  it('has a defaults table row for every OPTION_SPEC key with its default and description', () => {
    for (const [path, row] of Object.entries(OPTION_SPEC)) {
      const line = readme
        .split('\n')
        .find((l) => new RegExp(`^\\|\\s*\`${path.replace(/\./g, '\\.')}\`\\s*\\|`).test(l));
      expect(line, `README row for ${path}`).toBeDefined();
      expect(line).toContain(`\`${JSON.stringify(row.default)}\``);
      expect(line).toContain(row.description.replace(/\|/g, '\\|'));
    }
  });

  it.each([
    '## Install',
    '## Quick start',
    '## SchemaAdapter',
    '## Security',
    '## Docs UI',
    '## Response validation',
    '## Error shape',
    '## Incremental adoption',
    '## Route auto-detection',
    '**Opting out:**',
    '## Configuration',
  ])('documents %s', (heading) => {
    expect(readme).toContain(heading);
  });

  it('CHANGELOG has an entry for the first version', () => {
    const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
    const version = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ).version;
    expect(changelog).toContain(`## [${version}]`);
  });
});
