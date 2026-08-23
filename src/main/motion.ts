import type { AnimationIntensity, PetDirection, PetPosition, WalkActivity } from '../shared/types';

const SPEEDS: Record<AnimationIntensity, number> = { gentle: 55, normal: 85, lively: 120 };
export const WALK_ACTIVITY_PROFILES: Record<WalkActivity, { minDelayMs: number; maxDelayMs: number; maxStepPx: number }> = {
  quiet: { minDelayMs: 20_000, maxDelayMs: 35_000, maxStepPx: 35 },
  normal: { minDelayMs: 12_000, maxDelayMs: 22_000, maxStepPx: 70 },
  active: { minDelayMs: 8_000, maxDelayMs: 16_000, maxStepPx: 110 },
};

export function walkDelayMs(activity: WalkActivity, randomValue = Math.random()): number {
  const profile = WALK_ACTIVITY_PROFILES[activity];
  const random = Math.min(1, Math.max(0, randomValue));
  return Math.round(profile.minDelayMs + random * (profile.maxDelayMs - profile.minDelayMs));
}

export function walkDeltaPx(activity: WalkActivity, randomValue = Math.random()): number {
  const random = Math.min(1, Math.max(0, randomValue));
  return Math.round((random - .5) * WALK_ACTIVITY_PROFILES[activity].maxStepPx * 2);
}

export interface MotionPlan {
  from: PetPosition;
  to: PetPosition;
  direction: PetDirection;
  durationMs: number;
}

export function createMotionPlan(from: PetPosition, to: PetPosition, intensity: AnimationIntensity): MotionPlan {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const durationMs = Math.round(Math.min(2400, Math.max(500, distance / SPEEDS[intensity] * 1000)));
  return { from, to, direction: to.x < from.x ? 'left' : 'right', durationMs };
}

export function easeInOutSine(progress: number): number {
  const value = Math.min(1, Math.max(0, progress));
  if (value === 0 || value === 1) return value;
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

export function positionAt(plan: MotionPlan, progress: number): PetPosition {
  const eased = easeInOutSine(progress);
  return {
    x: Math.round(plan.from.x + (plan.to.x - plan.from.x) * eased),
    y: Math.round(plan.from.y + (plan.to.y - plan.from.y) * eased),
  };
}
