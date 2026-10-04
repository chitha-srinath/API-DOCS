// ST-007 (S-07): AC-004, ADR-24 — `./manual` has the same export names as `.`
// and does not patch `use` until `installRecorder()` is called.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

describe('entries/manual', () => {
  it('does not install the recorder until installRecorder() is called', () => {
    const manualPath = join(root, 'dist/manual.cjs').replace(/\\/g, '/');
    const script = `
      const RECORDER = Symbol.for('express-api-contract.v1.recorder');
      function installed(instance) {
        let proto = instance;
        while (proto) {
          if (Object.prototype.hasOwnProperty.call(proto, RECORDER)) return true;
          proto = Object.getPrototypeOf(proto);
        }
        return false;
      }
      const { installRecorder } = require('${manualPath}');
      const express = require('express');
      const before = installed(express.Router()) || installed(express.application);
      if (before) throw new Error('recorder installed before installRecorder() was called');
      installRecorder(express);
      const after = installed(express.Router()) && installed(express.application);
      if (!after) throw new Error('installRecorder() did not install the recorder');
    `;
    expect(() => execFileSync(process.execPath, ['-e', script], { cwd: root, stdio: 'pipe' })).not.toThrow();
  });
});
