import { describe, expect, it, vi } from 'vitest';
import type { PetRuntimeState } from '../shared/types';
import { InteractionController, type InteractionContext } from './interaction-controller';

function createHarness() {
  const context: InteractionContext = {
    bounds: { x: 100, y: 100, width: 220, height: 220 },
    stage: 'sprout', locked: false, mouseEnabled: true, keyboardEnabled: true,
    sleeping: false, careBusy: false, foregroundFullscreen: false,
  };
  const emitted: PetRuntimeState[] = [];
  const openPanel = vi.fn();
  const finishPetMove = vi.fn();
  const movePet = vi.fn();
  const controller = new InteractionController({
    getContext: () => context,
    emit: (runtime) => emitted.push(runtime),
    openPanel,
    finishPetMove,
    movePet,
  });
  return { context, emitted, openPanel, finishPetMove, movePet, controller };
}

describe('InteractionController', () => {
  it('resolves one, two and repeated taps after the double-click window', () => {
    const one = createHarness();
    one.controller.recordTap(1_000);
    one.controller.tick(null, 1_320);
    expect(one.controller.snapshot().interaction.kind).toBe('petting');

    const two = createHarness();
    two.controller.recordTap(1_000); two.controller.recordTap(1_150);
    two.controller.tick(null, 1_470);
    expect(two.openPanel).toHaveBeenCalledOnce();

    const three = createHarness();
    three.controller.recordTap(1_000); three.controller.recordTap(1_100); three.controller.recordTap(1_200);
    three.controller.tick(null, 1_520);
    expect(three.controller.snapshot().interaction.kind).toBe('dodge');
  });

  it('rejects dragging while locked and saves a completed drag', () => {
    const harness = createHarness();
    harness.context.locked = true;
    expect(harness.controller.beginDrag(1_000)).toBe(false);
    harness.context.locked = false;
    expect(harness.controller.beginDrag(1_000)).toBe(true);
    harness.controller.endDrag(1_500);
    expect(harness.finishPetMove).toHaveBeenCalledOnce();
    expect(harness.controller.snapshot().interaction.kind).toBe('landing');
  });

  it('keeps direct petting and dragging responsive while sleeping', () => {
    const harness = createHarness();
    harness.context.sleeping = true;
    harness.controller.recordTap(1_000);
    harness.controller.tick(null, 1_320);
    expect(harness.controller.snapshot().interaction.kind).toBe('petting');

    expect(harness.controller.beginDrag(1_500)).toBe(true);
    expect(harness.controller.snapshot().interaction.kind).toBe('dragging');
  });

  it('starts keyboard accompaniment from aggregate buckets and fails closed', () => {
    const harness = createHarness();
    harness.controller.setKeyboardStatus('ready', 0);
    for (let index = 0; index < 6; index += 1) harness.controller.recordKeyboardBucket(2, 250 + index * 250);
    harness.controller.tick(null, 1_500);
    expect(harness.controller.snapshot().interaction.kind).toBe('keyboard-typing');
    harness.controller.setKeyboardStatus('unavailable', 1_600);
    expect(harness.controller.snapshot().interaction.kind).toBe('idle');
    expect(harness.controller.snapshot().keyboardStatus).toBe('unavailable');
  });

  it('keeps a locked pet fixed while continuing gaze updates', () => {
    const harness = createHarness();
    harness.context.locked = true;
    harness.controller.tick({ x: 300, y: 150 }, 20_000);
    expect(harness.controller.snapshot().gaze.x).not.toBe(0);
    expect(harness.movePet).not.toHaveBeenCalled();
  });

  it('clears passive reactions while care or a foreground fullscreen app has control', () => {
    const harness = createHarness();
    harness.controller.setKeyboardStatus('ready', 0);
    for (let index = 0; index < 6; index += 1) harness.controller.recordKeyboardBucket(2, 250 + index * 250);
    harness.controller.tick(null, 1_500);
    expect(harness.controller.snapshot().interaction.kind).toBe('keyboard-typing');

    harness.context.foregroundFullscreen = true;
    harness.controller.tick({ x: 300, y: 150 }, 1_550);
    expect(harness.controller.snapshot().interaction.kind).toBe('idle');
    expect(harness.controller.snapshot().gaze).toEqual({ x: 0, y: 0 });
  });
});
