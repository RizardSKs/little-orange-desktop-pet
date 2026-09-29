import { describe, expect, it } from 'vitest';
import { actionAt, type ActionInput } from './actions';
import { petFrame } from './pet-frame';
import { STAGES } from './geometry';
import { CARE_DURATION_MS } from '../../shared/care';
import type { CareVisual } from '../../shared/types';

const input = (careAction: CareVisual, timeMs: number, extra: Partial<ActionInput> = {}): ActionInput => ({
  stage: 'lively', direction: 'right', intensity: 'normal', reduced: false, kind: 'care', itemId: null,
  careAction, careVariant: 0, timeMs, sequenceId: 1, moving: false, durationMs: CARE_DURATION_MS[careAction], ...extra,
});

describe('care story frames', () => {
  it('supports deterministic seeks, all stages, directions, intensities and variants without invalid frames', () => {
    for (const action of Object.keys(CARE_DURATION_MS) as CareVisual[]) for (const stage of STAGES)
      for (const direction of ['left', 'right'] as const) for (const intensity of ['gentle', 'normal', 'lively'] as const)
        for (const reduced of [false, true]) for (const careVariant of [0, 1, 2]) {
          const duration = CARE_DURATION_MS[action] ?? 18000;
          for (const part of [0, .15, .32, .55, .78, .98, 1, 1.2]) {
            const request = input(action, duration * part, { stage, direction, intensity, reduced, careVariant });
            const frame = petFrame(request, 'glasses', 'neutral', '/assets');
            expect(frame.drawables.every(d => d.matrix.every(Number.isFinite))).toBe(true);
            expect(new Set(frame.drawables.map(d => d.id)).size).toBe(frame.drawables.length);
            for (const grip of frame.grips) expect(Math.hypot(grip.hand.x - grip.prop.x, grip.hand.y - grip.prop.y)).toBeLessThan(.001);
            expect(actionAt(request)).toEqual(actionAt(request));
          }
        }
  });
  it('finishes short stories before the deadline and does not replay missed frames', () => {
    for (const action of ['feed', 'play', 'clean', 'wake'] as const) {
      for (const duration of [900, CARE_DURATION_MS[action]!]) {
        expect(actionAt(input(action, duration, { durationMs: duration })).extras).toEqual([]);
        expect(actionAt(input(action, duration * 10, { durationMs: duration })).safe).toBe(true);
      }
    }
  });
  it('ends sleep entry in the same held posture as the persistent loop', () => {
    const entry = actionAt(input('sleep-in', 4000));
    const loop = actionAt(input('sleep-loop', 0));
    expect(entry.expression).toBe('asleep'); expect(loop.expression).toBe('asleep');
    expect(Math.abs(entry.pose.body.rotation - loop.pose.body.rotation)).toBeLessThan(.01);
    expect(loop.extras.some(d => d.id === 'action-prop')).toBe(true);
    expect(actionAt(input('sleep-loop', 18000)).safe).toBe(true);
  });
  it('has visible behavioral differences and no invisible props in degraded care', () => {
    for (const action of ['feed', 'play', 'clean', 'sleep-in', 'wake'] as const) {
      const duration = CARE_DURATION_MS[action]!;
      const snapshots = [0, 1, 2].map(careVariant => [.2, .4, .55, .72].map(p => actionAt(input(action, p * duration, { careVariant }))));
      expect(snapshots[0], action + " variant 1").not.toEqual(snapshots[1]); expect(snapshots[0], action + " variant 2").not.toEqual(snapshots[2]);
      const fallback = actionAt(input(action, duration * .4, { hideCareProps: true }));
      expect(fallback.extras.some(d => d.src?.includes('/props/'))).toBe(false);
      expect(fallback.replaceArms).toBe(true);
    }
  });
});
