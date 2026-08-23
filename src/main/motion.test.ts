import { describe, expect, it } from 'vitest';
import { createMotionPlan, easeInOutSine, positionAt, walkDelayMs, walkDeltaPx } from './motion';

describe('desktop movement planning', () => {
  it('chooses direction and clamps duration by animation intensity', () => {
    expect(createMotionPlan({ x: 100, y: 0 }, { x: 0, y: 0 }, 'normal').direction).toBe('left');
    expect(createMotionPlan({ x: 0, y: 0 }, { x: 1, y: 0 }, 'gentle').durationMs).toBe(500);
    expect(createMotionPlan({ x: 0, y: 0 }, { x: 10_000, y: 0 }, 'lively').durationMs).toBe(2400);
    expect(createMotionPlan({ x: 0, y: 0 }, { x: 100, y: 0 }, 'gentle').durationMs)
      .toBeGreaterThan(createMotionPlan({ x: 0, y: 0 }, { x: 100, y: 0 }, 'lively').durationMs);
  });

  it('interpolates monotonically and lands exactly on the target', () => {
    const plan = createMotionPlan({ x: 10, y: 20 }, { x: 110, y: 70 }, 'normal');
    const points = [0, .25, .5, .75, 1].map((progress) => positionAt(plan, progress));
    expect(points[0]).toEqual(plan.from);
    expect(points.at(-1)).toEqual(plan.to);
    expect(points.map(({ x }) => x)).toEqual([...points.map(({ x }) => x)].sort((a, b) => a - b));
    expect(easeInOutSine(-1)).toBe(0);
    expect(easeInOutSine(2)).toBe(1);
  });

  it('keeps walk activity delay and range independent from animation intensity', () => {
    expect([walkDelayMs('quiet', 0), walkDelayMs('quiet', 1)]).toEqual([20_000, 35_000]);
    expect([walkDelayMs('normal', 0), walkDelayMs('normal', 1)]).toEqual([12_000, 22_000]);
    expect([walkDelayMs('active', 0), walkDelayMs('active', 1)]).toEqual([8_000, 16_000]);
    expect([walkDeltaPx('quiet', 0), walkDeltaPx('quiet', 1)]).toEqual([-35, 35]);
    expect([walkDeltaPx('normal', 0), walkDeltaPx('normal', 1)]).toEqual([-70, 70]);
    expect([walkDeltaPx('active', 0), walkDeltaPx('active', 1)]).toEqual([-110, 110]);
  });
});
