import type { AnimationIntensity, PetDirection } from '../shared/types';

export interface DragVisual {
  direction: PetDirection | null;
  tiltDeg: number;
  liftPx: number;
  stretchX: number;
  stretchY: number;
}

const INTENSITY_SCALE: Record<AnimationIntensity, number> = {
  gentle: 0.65,
  normal: 1,
  lively: 1.25,
};

export function dragVisualForMovement(dx: number, dy: number, elapsedMs: number, intensity: AnimationIntensity): DragVisual {
  const safeElapsed = Math.max(8, elapsedMs);
  const velocityX = dx / safeElapsed;
  const velocityY = dy / safeElapsed;
  const speed = Math.min(1, Math.hypot(velocityX, velocityY) / 1.4);
  const scale = INTENSITY_SCALE[intensity];
  const direction: PetDirection | null = dx < -0.25 ? 'left' : dx > 0.25 ? 'right' : null;
  const signedTilt = Math.max(-1, Math.min(1, velocityX / 1.1));
  return {
    direction,
    tiltDeg: signedTilt * 11 * scale,
    liftPx: -Math.min(8, (2 + speed * 6) * scale),
    stretchX: 1 + speed * 0.045 * scale,
    stretchY: 1 - speed * 0.035 * scale,
  };
}

export const RESTING_DRAG_VISUAL: DragVisual = {
  direction: null,
  tiltDeg: 0,
  liftPx: 0,
  stretchX: 1,
  stretchY: 1,
};
