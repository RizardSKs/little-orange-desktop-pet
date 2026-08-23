import type { GrowthStage, KeyboardTempo, PetDirection, PetInteractionKind, PetPosition } from './types';

export const CURSOR_SAMPLE_MS = 50;
export const TAP_SETTLE_MS = 320;
export const DRAG_THRESHOLD_DIP = 7;
export const KEYBOARD_TRIGGER_WINDOW_MS = 800;
export const KEYBOARD_QUIET_WINDOW_MS = 900;

export interface TimedPoint extends PetPosition { at: number }

export interface InteractionStageProfile {
  amplitude: number;
  duration: number;
  personality: 'shy' | 'bouncy' | 'steady' | 'radiant';
}

export const INTERACTION_STAGE_PROFILES: Record<GrowthStage, InteractionStageProfile> = {
  sprout: { amplitude: 0.75, duration: 1.12, personality: 'shy' },
  lively: { amplitude: 1.15, duration: 0.86, personality: 'bouncy' },
  mature: { amplitude: 0.95, duration: 1, personality: 'steady' },
  radiant: { amplitude: 1.05, duration: 0.9, personality: 'radiant' },
};

export const INTERACTION_PRIORITY: Record<PetInteractionKind, number> = {
  idle: 0,
  nearby: 30,
  'keyboard-rest': 50,
  'cursor-paw': 50,
  'cursor-tug': 60,
  'cursor-chase': 60,
  'cursor-dizzy': 60,
  'keyboard-typing': 70,
  petting: 90,
  dodge: 92,
  landing: 95,
  dragging: 100,
};

export const INTERACTION_DURATION_MS: Partial<Record<PetInteractionKind, number>> = {
  nearby: 3_500,
  petting: 1_200,
  dodge: 900,
  landing: 650,
  'keyboard-rest': 700,
  'cursor-paw': 1_350,
  'cursor-tug': 2_200,
  'cursor-chase': 2_400,
  'cursor-dizzy': 1_800,
};

export function canInterruptInteraction(current: PetInteractionKind, next: PetInteractionKind): boolean {
  if (current === next) return false;
  return INTERACTION_PRIORITY[next] > INTERACTION_PRIORITY[current];
}

export function directionToward(fromX: number, targetX: number): PetDirection {
  return targetX < fromX ? 'left' : 'right';
}

export function gazeForCursor(cursor: PetPosition, center: PetPosition): PetPosition {
  const dx = cursor.x - center.x;
  const dy = cursor.y - center.y;
  if (Math.hypot(dx, dy) > 700) return { x: 0, y: 0 };
  return {
    x: Math.max(-1, Math.min(1, dx / 350)),
    y: Math.max(-1, Math.min(1, dy / 250)),
  };
}

export function distanceBetween(a: PetPosition, b: PetPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function cursorPathLength(samples: readonly TimedPoint[]): number {
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) length += distanceBetween(samples[index - 1], samples[index]);
  return length;
}

export function horizontalDirectionChanges(samples: readonly TimedPoint[]): number {
  let previousSign = 0;
  let changes = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].x - samples[index - 1].x;
    const sign = Math.abs(delta) < 3 ? 0 : Math.sign(delta);
    if (sign && previousSign && sign !== previousSign) changes += 1;
    if (sign) previousSign = sign;
  }
  return changes;
}

export function isTeasingCursor(samples: readonly TimedPoint[], center: PetPosition): boolean {
  if (samples.length < 5) return false;
  const recent = samples.filter(({ at }) => at >= samples.at(-1)!.at - 2_000);
  if (recent.length < 5) return false;
  const inRing = recent.filter((sample) => {
    const radius = distanceBetween(sample, center);
    return radius >= 70 && radius <= 230;
  });
  return inRing.length / recent.length >= 0.7
    && cursorPathLength(inRing) >= 420
    && horizontalDirectionChanges(inRing) >= 4;
}

export function accumulatedCursorTurns(samples: readonly TimedPoint[], center: PetPosition): number {
  if (samples.length < 4) return 0;
  let total = 0;
  let previousAngle: number | null = null;
  for (const sample of samples) {
    const radius = distanceBetween(sample, center);
    if (radius < 80 || radius > 240) {
      previousAngle = null;
      continue;
    }
    const angle = Math.atan2(sample.y - center.y, sample.x - center.x);
    if (previousAngle !== null) {
      let delta = angle - previousAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) <= Math.PI / 2) total += delta;
    }
    previousAngle = angle;
  }
  return Math.abs(total) / (Math.PI * 2);
}

export function isNearbyCursor(samples: readonly TimedPoint[], center: PetPosition): boolean {
  if (samples.length < 2) return false;
  const latest = samples.at(-1)!;
  const recent = samples.filter(({ at }) => at >= latest.at - 6_000);
  if (recent.length < 2 || recent[0].at > latest.at - 5_900) return false;
  if (recent.some((sample) => distanceBetween(sample, center) > 160)) return false;
  const elapsedSeconds = Math.max(0.001, (latest.at - recent[0].at) / 1_000);
  return cursorPathLength(recent) / elapsedSeconds <= 25;
}

export function keyboardRhythmIsBusy(buckets: readonly { count: number; endedAt: number }[], now: number): boolean {
  return buckets
    .filter(({ endedAt }) => endedAt > now - KEYBOARD_TRIGGER_WINDOW_MS && endedAt <= now + 250)
    .reduce((sum, bucket) => sum + bucket.count, 0) >= 3;
}

export function keyboardRhythmIsQuiet(buckets: readonly { count: number; endedAt: number }[], now: number): boolean {
  return buckets
    .filter(({ endedAt }) => endedAt > now - KEYBOARD_QUIET_WINDOW_MS && endedAt <= now + 250)
    .reduce((sum, bucket) => sum + bucket.count, 0) === 0;
}

export function keyboardTempoForBuckets(buckets: readonly { count: number; endedAt: number }[], now: number): KeyboardTempo {
  const count = buckets
    .filter(({ endedAt }) => endedAt > now - KEYBOARD_TRIGGER_WINDOW_MS && endedAt <= now + 250)
    .reduce((sum, bucket) => sum + bucket.count, 0);
  if (count >= 8) return 'rapid';
  if (count >= 5) return 'steady';
  return 'calm';
}
