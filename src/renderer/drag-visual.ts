import type { AnimationIntensity, PetDirection } from '../shared/types';

export interface DragVelocity { x: number; y: number }

export interface DragVisual {
  direction: PetDirection | null;
  tiltDeg: number;
  liftPx: number;
  swayPx: number;
  stretchX: number;
  stretchY: number;
  limbSwingDeg: number;
  landingDriftPx: number;
  velocityX: number;
  velocityY: number;
}

const INTENSITY_SCALE: Record<AnimationIntensity, number> = {
  gentle: 0.65,
  normal: 1,
  lively: 1.25,
};

export function dragVisualForMovement(
  dx: number,
  dy: number,
  elapsedMs: number,
  intensity: AnimationIntensity,
  previous: DragVelocity = { x: 0, y: 0 },
): DragVisual {
  const safeElapsed = Math.max(8, elapsedMs);
  const blend = 1 - Math.exp(-safeElapsed / 55);
  const rawX = Math.max(-2.4, Math.min(2.4, dx / safeElapsed));
  const rawY = Math.max(-2.4, Math.min(2.4, dy / safeElapsed));
  const velocityX = previous.x + (rawX - previous.x) * blend;
  const velocityY = previous.y + (rawY - previous.y) * blend;
  const speed = Math.min(1, Math.hypot(velocityX, velocityY) / 1.4);
  const scale = INTENSITY_SCALE[intensity];
  const direction: PetDirection | null = velocityX < -0.08 ? 'left' : velocityX > 0.08 ? 'right' : null;
  const signedTilt = Math.max(-1, Math.min(1, velocityX / 1.15));
  return {
    direction,
    tiltDeg: signedTilt * 12 * scale,
    liftPx: -Math.min(11, (3 + speed * 7 + Math.max(0, -velocityY) * 1.5) * scale),
    swayPx: signedTilt === 0 ? 0 : -signedTilt * 4 * scale,
    stretchX: 1 + Math.abs(velocityX) / 2.4 * 0.04 * scale,
    stretchY: 1 + Math.abs(velocityY) / 2.4 * 0.045 * scale - speed * 0.025 * scale,
    limbSwingDeg: (3 + speed * 7) * scale,
    landingDriftPx: signedTilt * 14 * scale,
    velocityX,
    velocityY,
  };
}

export const RESTING_DRAG_VISUAL: DragVisual = {
  direction: null,
  tiltDeg: 0,
  liftPx: 0,
  swayPx: 0,
  stretchX: 1,
  stretchY: 1,
  limbSwingDeg: 0,
  landingDriftPx: 0,
  velocityX: 0,
  velocityY: 0,
};
