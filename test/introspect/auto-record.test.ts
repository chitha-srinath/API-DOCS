// ST-005 (S-05), ADR-23/ADR-24: the default install entry.
import { describe, expect, it, vi } from 'vitest';

import { autoRecord } from '../../src/introspect/auto-record.js';
import { isRecorderInstalled } from '../../src/introspect/recorder.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe('auto-record', () => {
  it('installs the recorder on the resolved root express', () => {
    const [entry] = majors;
    if (!entry) throw new Error('no express majors resolved');
    autoRecord(() => entry.express);
    const mod = entry.express as { Router: () => object };
    const owner = Object.getPrototypeOf(mod.Router());
    expect(isRecorderInstalled(owner)).toBe(true);
  });

  it('swallows a resolution failure with one warn', () => {
    const log = makeLoggerSpy();
    expect(() =>
      autoRecord(() => {
        throw new Error('cannot find module express');
      }, log),
    ).not.toThrow();
    expect(log.warns('EAD_AUTO_RECORD_RESOLUTION_FAILED')).toHaveLength(1);
  });

  it('the default logger writes a console.warn on a resolution failure', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() =>
      autoRecord(() => {
        throw new Error('boom');
      }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('EAD_AUTO_RECORD_RESOLUTION_FAILED'), 'boom');
    spy.mockRestore();
  });

  it('importing src/auto-record.ts installs the recorder on the resolved root express', async () => {
    await import('../../src/auto-record.js');
    const [entry] = majors;
    if (!entry) throw new Error('no express majors resolved');
    const mod = entry.express as { Router: () => object };
    const owner = Object.getPrototypeOf(mod.Router());
    expect(isRecorderInstalled(owner)).toBe(true);
  });
});
