import { describe, expect, it } from 'vitest';
import { createMotionPlan, easeInOutSine, positionAt } from './motion';

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
});
