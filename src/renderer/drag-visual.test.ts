import { describe, expect, it } from 'vitest';
import { dragVisualForMovement } from './drag-visual';

describe('dragVisualForMovement', () => {
  it('faces and tilts toward horizontal travel', () => {
    expect(dragVisualForMovement(40, 0, 16, 'normal').tiltDeg).toBeGreaterThan(0);
    expect(dragVisualForMovement(-40, 0, 16, 'normal').tiltDeg).toBeLessThan(0);
  });

  it('clamps speed and scales motion by animation intensity', () => {
    const gentle = dragVisualForMovement(1_000, 1_000, 8, 'gentle');
    const lively = dragVisualForMovement(1_000, 1_000, 8, 'lively');
    expect(gentle.stretchX).toBeLessThan(lively.stretchX);
    expect(gentle.liftPx).toBeGreaterThan(lively.liftPx);
    expect(lively.limbSwingDeg).toBeGreaterThan(gentle.limbSwingDeg);
    expect(lively.stretchX).toBeLessThanOrEqual(1.05);
  });

  it('smooths reversals and carries the final velocity into landing', () => {
    const forward = dragVisualForMovement(80, 0, 16, 'normal');
    const reversing = dragVisualForMovement(-8, 0, 16, 'normal', { x: forward.velocityX, y: forward.velocityY });
    expect(Math.abs(reversing.velocityX)).toBeLessThan(Math.abs(forward.velocityX));
    expect(forward.landingDriftPx).toBeGreaterThan(0);
  });

  it('keeps a stable airborne pose when movement is stationary', () => {
    expect(dragVisualForMovement(0, 0, 16, 'normal')).toMatchObject({
      direction: null, tiltDeg: 0, liftPx: -3, swayPx: 0, stretchX: 1, velocityX: 0, velocityY: 0,
    });
  });
});
