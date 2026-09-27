import { describe, expect, it, vi } from 'vitest';
import { wrapAsync } from '../../src/route/async.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('wrapAsync', () => {
  it('forwards a rejection to next', async () => {
    const next = vi.fn();
    const reason = new Error('r');
    wrapAsync(() => Promise.reject(reason))({} as any, { headersSent: false } as any, next);
    await flush();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(reason);
  });

  it('forwards a sync throw to next', () => {
    const next = vi.fn();
    const error = new Error('s');
    wrapAsync(() => {
      throw error;
    })({} as any, { headersSent: false } as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next again after headers are sent', async () => {
    const next = vi.fn();
    wrapAsync(() => Promise.reject(new Error('late')))(
      {} as any,
      { headersSent: true } as any,
      next,
    );
    await flush();
    expect(next).toHaveBeenCalledTimes(0);
  });

  it('does not call next for a resolved handler', async () => {
    const next = vi.fn();
    wrapAsync(async () => 'done')({} as any, { headersSent: false } as any, next);
    await flush();
    expect(next).toHaveBeenCalledTimes(0);
  });

  it('passes req, res and next to the handler', () => {
    const handler = vi.fn();
    const req = {};
    const res = { headersSent: false };
    const next = vi.fn();
    wrapAsync(handler)(req as any, res as any, next);
    expect(handler).toHaveBeenCalledWith(req, res, next);
  });
});
