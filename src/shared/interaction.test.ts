import { describe, expect, it } from 'vitest';
import {
  accumulatedCursorTurns,
  canInterruptInteraction,
  gazeForCursor,
  horizontalDirectionChanges,
  INTERACTION_STAGE_PROFILES,
  isNearbyCursor,
  isTeasingCursor,
  keyboardRhythmIsBusy,
  keyboardRhythmIsQuiet,
  keyboardTempoForBuckets,
  type TimedPoint,
} from './interaction';

describe('interaction rules', () => {
  it('normalizes gaze and returns to center outside the tracking radius', () => {
    expect(gazeForCursor({ x: 350, y: -250 }, { x: 0, y: 0 })).toEqual({ x: 1, y: -1 });
    expect(gazeForCursor({ x: 701, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('keeps manual and direct interactions above ambient ones', () => {
    expect(canInterruptInteraction('nearby', 'cursor-paw')).toBe(true);
    expect(canInterruptInteraction('petting', 'keyboard-typing')).toBe(false);
    expect(canInterruptInteraction('landing', 'dragging')).toBe(true);
  });

  it('detects repeated near-pet teasing motion', () => {
    const samples: TimedPoint[] = [];
    for (let index = 0; index < 13; index += 1) samples.push({ x: index % 2 ? 340 : 100, y: 100, at: index * 150 });
    expect(horizontalDirectionChanges(samples)).toBeGreaterThanOrEqual(4);
    expect(isTeasingCursor(samples, { x: 220, y: 100 })).toBe(true);
  });

  it('detects circular cursor motion and nearby dwell', () => {
    const circle: TimedPoint[] = Array.from({ length: 25 }, (_, index) => {
      const angle = index / 24 * Math.PI * 4;
      return { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120, at: index * 100 };
    });
    expect(accumulatedCursorTurns(circle, { x: 0, y: 0 })).toBeGreaterThan(1.9);

    const nearby: TimedPoint[] = Array.from({ length: 13 }, (_, index) => ({ x: 20 + index, y: 10, at: index * 500 }));
    expect(isNearbyCursor(nearby, { x: 0, y: 0 })).toBe(true);
  });

  it('recognizes busy and quiet aggregate keyboard rhythm without key data', () => {
    const busy = [{ count: 3, endedAt: 750 }];
    expect(keyboardRhythmIsBusy(busy, 800)).toBe(true);
    expect(keyboardRhythmIsQuiet(busy, 800)).toBe(false);
    expect(keyboardRhythmIsQuiet(busy, 1_700)).toBe(true);
    expect(keyboardTempoForBuckets([{ count: 3, endedAt: 750 }], 800)).toBe('calm');
    expect(keyboardTempoForBuckets([{ count: 5, endedAt: 750 }], 800)).toBe('steady');
    expect(keyboardTempoForBuckets([{ count: 8, endedAt: 750 }], 800)).toBe('rapid');
    expect(Object.keys(busy[0])).toEqual(['count', 'endedAt']);
  });

  it('defines a visibly distinct profile for every growth stage', () => {
    expect(Object.keys(INTERACTION_STAGE_PROFILES)).toEqual(['sprout', 'lively', 'mature', 'radiant']);
    expect(new Set(Object.values(INTERACTION_STAGE_PROFILES).map(({ personality }) => personality)).size).toBe(4);
  });
});
