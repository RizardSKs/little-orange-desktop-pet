import { statCap } from './game';
import type { PetExpression, PetStats, SaveData } from './types';

export const IDLE_EXPRESSIONS = ['neutral', 'happy', 'curious', 'surprised', 'proud'] as const satisfies readonly PetExpression[];

const BEHAVIOR_EXPRESSIONS: Partial<Record<SaveData['pet']['behavior'], PetExpression>> = {
  walking: 'focused',
  eating: 'delighted',
  playing: 'excited',
  cleaning: 'refreshed',
  sleeping: 'asleep',
  sad: 'sad',
};

const NEED_EXPRESSIONS: Record<keyof PetStats, PetExpression> = {
  satiety: 'hungry',
  mood: 'sad',
  energy: 'sleepy',
  cleanliness: 'uncomfortable',
};

const NEED_TIE_PRIORITY: (keyof PetStats)[] = ['energy', 'satiety', 'cleanliness', 'mood'];

export function idleExpressionFromRoll(roll: number): PetExpression {
  const value = Math.min(0.999999, Math.max(0, roll));
  if (value < 0.4) return 'neutral';
  if (value < 0.65) return 'happy';
  if (value < 0.8) return 'curious';
  if (value < 0.9) return 'surprised';
  return 'proud';
}

export function resolvePetExpression(state: SaveData, idleRoll = 0): PetExpression {
  const behaviorExpression = BEHAVIOR_EXPRESSIONS[state.pet.behavior];
  if (behaviorExpression) return behaviorExpression;

  const cap = statCap(state.growth.level);
  let lowestKey: keyof PetStats | null = null;
  let lowestRatio = Number.POSITIVE_INFINITY;
  for (const key of NEED_TIE_PRIORITY) {
    const ratio = state.pet.stats[key] / cap;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      lowestKey = key;
    }
  }
  if (lowestKey && lowestRatio <= 0.2) return NEED_EXPRESSIONS[lowestKey];
  return idleExpressionFromRoll(idleRoll);
}
