import { describe, expect, it } from 'vitest';
import { actionAt, type ActionInput } from './actions';
import { SAMPLE_IDS, SAMPLE_TIMING } from './sample-actions';
import { findInventoryItem } from '../../shared/catalog';
import { BODY_LANDMARKS } from './attachments';
import { bodyMatrix, REST_POSE, STAGES, transform } from './geometry';
import { interruptProps, exitAt } from './interruptions';
import { petFrame } from './pet-frame';

const base: ActionInput = { stage: 'lively', direction: 'right', itemId: null, kind: 'inventory-use', timeMs: 0, sequenceId: 8, intensity: 'normal', reduced: false, moving: false };
describe('finite sample choreography', () => {
  it('closes before the controller deadline, including shortened durations and skipped frames', () => {
    for (const itemId of SAMPLE_IDS) for (const durationMs of [500, 3000, findInventoryItem(itemId)!.useVisual.durationMs]) {
      const input = { ...base, itemId, durationMs };
      const start = actionAt(input);
      expect(start.extras).toEqual([]);
      expect(start.safe).toBe(true);
      const held = actionAt({ ...input, timeMs: durationMs * .5 });
      expect(held.extras.some(part => part.id === 'action-prop')).toBe(true);
      const final = actionAt({ ...input, timeMs: durationMs - 1 });
      expect(final.extras).toEqual([]);
      expect(final.replaceArms).toBe(false);
      expect(final.pose.body).toEqual(REST_POSE);
      for (const timeMs of [durationMs, durationMs * 5]) {
        expect(actionAt({ ...input, timeMs }).extras).toEqual([]);
        expect(actionAt({ ...input, timeMs }).safe).toBe(true);
      }
      // Seeking backwards or across the deadline cannot leave state behind.
      expect(actionAt({ ...input, timeMs: durationMs * .5 })).toEqual(held);
    }
  });
  it('keeps all contact pairs exact over the full action, all stages, facing and motion modes', () => {
    for (const itemId of SAMPLE_IDS) for (const stage of STAGES) for (const direction of ['left', 'right'] as const) for (const reduced of [true, false]) {
      const duration = findInventoryItem(itemId)!.useVisual.durationMs;
      let pairs = 0;
      for (let timeMs = 0; timeMs <= duration; timeMs += 1000 / 30) {
        const frame = actionAt({ ...base, itemId, stage, direction, reduced, timeMs });
        for (const pair of frame.grips) {
          expect(Math.hypot(pair.hand.x - pair.prop.x, pair.hand.y - pair.prop.y)).toBeLessThan(1e-6);
          pairs++;
        }
      }
      if (itemId !== 'item-mini-keyboard') expect(pairs).toBeGreaterThan(0);
    }
  });
  it('uses the visible straw tip as the drinking contact in both directions', () => {
    for (const stage of STAGES) for (const direction of ['left', 'right'] as const) {
      const input = { ...base, stage, direction, itemId: 'item-honey-soda' as const, timeMs: SAMPLE_TIMING.enterMs + 600 };
      const frame = actionAt(input);
      const prop = frame.extras.find(part => part.id === 'action-prop')!;
      const tip = transform(prop.matrix, { x: 354, y: 34 });
      const mouth = transform(bodyMatrix(frame.pose.body, direction), { x: BODY_LANDMARKS[stage].eyes.x, y: { sprout: 355, lively: 340, mature: 367, radiant: 377 }[stage] });
      expect(Math.hypot(tip.x - mouth.x, tip.y - mouth.y)).toBeLessThan(1e-6);
    }
  });
  it('keeps the keyboard fixed while hands alternate and return during the pause', () => {
    const input = { ...base, itemId: 'item-mini-keyboard' as const };
    const first = actionAt({ ...input, timeMs: 1250 });
    const next = actionAt({ ...input, timeMs: 1530 });
    const find = (frame: typeof first, id: string) => frame.extras.find(part => part.id === id)!.matrix;
    expect(find(first, 'action-prop')).toEqual(find(next, 'action-prop'));
    expect(find(first, 'left-hand')).not.toEqual(find(next, 'left-hand'));
    expect(find(first, 'right-hand')).not.toEqual(find(next, 'right-hand'));
  });
  it('does not delay a new action or play success gestures after an interruption', () => {
    const held = petFrame({ ...base, itemId: 'item-honey-soda', timeMs: 1600 }, null, 'refreshed', '/assets');
    const exit = interruptProps(held.drawables, held.policy, 2000, base.sequenceId, false);
    const next = actionAt({ ...base, kind: 'dragging', itemId: null, sequenceId: 9, timeMs: 0 });
    expect(next.phase).toBe('retract');
    expect(next.extras).toEqual([]);
    expect(exitAt(exit, 2200)).toEqual([]);
    expect(exitAt(exit, 2000).every(part => part.id.startsWith('exit-'))).toBe(true);
  });
  it('keeps motion-preference transitions geometric and never reports a false ball contact', () => {
    for (const itemId of SAMPLE_IDS) for (const motionWeight of [0, .2, .6, 1]) {
      const frame = actionAt({ ...base, itemId, reduced: true, motionWeight, timeMs: 1050 });
      for (const pair of frame.grips) expect(Math.hypot(pair.hand.x-pair.prop.x,pair.hand.y-pair.prop.y)).toBeLessThan(1e-6);
      const prop = frame.extras.find(part => part.id === 'action-prop')!;
      expect(Math.hypot(prop.matrix[0],prop.matrix[1])).toBeCloseTo(Math.hypot(prop.matrix[2],prop.matrix[3]),12);
    }
  });
  it('pauses brushing for a curious inspection without dropping the handle', () => {
    const input = { ...base, itemId: 'service-cozy-grooming' as const };
    expect(actionAt({ ...input, timeMs: 2000 }).expression).toBe('happy');
    const pause = actionAt({ ...input, timeMs: 4100 });
    expect(pause.expression).toBe('curious');
    expect(pause.grips).toHaveLength(1);
    expect(pause.grips[0].hand).toEqual(pause.grips[0].prop);
  });
});
