import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeScheduler } from './runtime-scheduler';

afterEach(() => vi.useRealTimers());

describe('RuntimeScheduler', () => {
  it('stops intervals, pending timeouts, and recursive re-scheduling', () => {
    vi.useFakeTimers();
    const scheduler = new RuntimeScheduler();
    const interval = vi.fn();
    const recursive = vi.fn(() => scheduler.setTimeout(recursive, 25));
    scheduler.setInterval(interval, 10);
    scheduler.setTimeout(recursive, 25);

    vi.advanceTimersByTime(25);
    expect(interval).toHaveBeenCalledTimes(2);
    expect(recursive).toHaveBeenCalledOnce();

    scheduler.stop();
    scheduler.stop();
    vi.advanceTimersByTime(100);
    expect(interval).toHaveBeenCalledTimes(2);
    expect(recursive).toHaveBeenCalledOnce();
    expect(scheduler.isActive).toBe(false);
    expect(scheduler.setTimeout(vi.fn(), 1)).toBeNull();
  });

  it('removes an explicitly cleared timeout', () => {
    vi.useFakeTimers();
    const scheduler = new RuntimeScheduler();
    const callback = vi.fn();
    const handle = scheduler.setTimeout(callback, 10);
    scheduler.clearTimeout(handle);
    vi.advanceTimersByTime(20);
    expect(callback).not.toHaveBeenCalled();
  });
});
