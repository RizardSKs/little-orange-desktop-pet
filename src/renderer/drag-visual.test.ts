import { describe, expect, it } from 'vitest';
import { dragVisualForMovement } from './drag-visual';

describe('dragVisualForMovement', () => {
  it('faces and tilts toward horizontal travel', () => {
    expect(dragVisualForMovement(40, 0, 16, 'normal')).toMatchObject({ direction: 'right', tiltDeg: 11 });
    expect(dragVisualForMovement(-40, 0, 16, 'normal')).toMatchObject({ direction: 'left', tiltDeg: -11 });
  });

  it('clamps speed and scales motion by animation intensity', () => {
    const gentle = dragVisualForMovement(1_000, 1_000, 8, 'gentle');
    const lively = dragVisualForMovement(1_000, 1_000, 8, 'lively');
    expect(gentle.stretchX).toBeLessThan(lively.stretchX);
    expect(gentle.liftPx).toBeGreaterThan(lively.liftPx);
    expect(lively.stretchX).toBeLessThanOrEqual(1.057);
  });

  it('returns a near-resting pose when movement is stationary', () => {
    expect(dragVisualForMovement(0, 0, 16, 'normal')).toEqual({
      direction: null, tiltDeg: 0, liftPx: -2, stretchX: 1, stretchY: 1,
    });
  });
});
