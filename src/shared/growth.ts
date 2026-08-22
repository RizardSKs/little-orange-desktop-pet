import type { GrowthStage } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 50;
export const LEGACY_MAX_LEVEL = 20;
export const LEGACY_EXPERIENCE_SCALE = 3;

export const LEVEL_TITLES: Readonly<Record<number, string>> = Object.freeze({
  1: '初醒幼芽',
  2: '好奇幼芽',
  3: '蹦跳幼芽',
  4: '茁壮幼芽',
  5: '元气新秀',
  6: '活力伙伴',
  7: '探索小将',
  8: '阳光舞者',
  9: '朝气之星',
  10: '稳健新橙',
  11: '从容伙伴',
  12: '可靠守候',
  13: '温暖之心',
  14: '自信步伐',
  15: '成熟小将',
  16: '沉着陪伴',
  17: '丰盈时光',
  18: '光芒前奏',
  19: '待耀之星',
  20: '闪耀新星',
});

const STAR_TITLES = ['闪耀新星', '闪耀一星', '闪耀二星', '闪耀三星', '闪耀四星', '闪耀五星', '闪耀六星·圆满'] as const;
const STAGE_MILESTONES = new Set([5, 10, 20]);
const MAJOR_MILESTONES = [5, 10, 20, 25, 30, 35, 40, 45, 50] as const;

const normalizedLevel = (level: number): number => {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(level)));
};

export function stageForLevel(level: number): GrowthStage {
  const normalized = normalizedLevel(level);
  if (normalized >= 20) return 'radiant';
  if (normalized >= 10) return 'mature';
  if (normalized >= 5) return 'lively';
  return 'sprout';
}

export function experienceForNextLevel(level: number): number {
  return 150 * (normalizedLevel(level) + 1);
}

export function legacyExperienceForNextLevel(level: number): number {
  const normalized = Math.min(LEGACY_MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(level)));
  return 50 * (normalized + 1);
}

export function cumulativeExperienceForLevel(level: number): number {
  const normalized = normalizedLevel(level);
  return 75 * (normalized - 1) * (normalized + 2);
}

export function statCap(level: number): number {
  const normalized = normalizedLevel(level);
  return normalized <= 20 ? 100 + (normalized - 1) * 2 : 138 + (normalized - 20);
}

export function radiantStarsForLevel(level: number): number {
  const normalized = normalizedLevel(level);
  return normalized < 25 ? 0 : Math.min(6, Math.floor((normalized - 20) / 5));
}

export function levelTitleForLevel(level: number): string {
  const normalized = normalizedLevel(level);
  if (normalized <= LEGACY_MAX_LEVEL) return LEVEL_TITLES[normalized];
  return STAR_TITLES[radiantStarsForLevel(normalized)];
}

export type GrowthMilestoneKind = 'level' | 'stage' | 'star' | 'max';

export interface GrowthMilestone {
  level: number;
  kind: GrowthMilestoneKind;
  title: string;
  stage: GrowthStage;
  radiantStars: number;
}

export interface GrowthProgressEvent {
  source: 'online' | 'care';
  fromLevel: number;
  toLevel: number;
  milestones: GrowthMilestone[];
}

export interface GrowthDescriptor {
  level: number;
  stage: GrowthStage;
  title: string;
  radiantStars: number;
  nextLevelExperience: number | null;
  nextLevelTitle: string | null;
  nextMilestoneLevel: number | null;
  nextMilestoneLabel: string | null;
}

function milestoneKind(level: number): GrowthMilestoneKind {
  if (level === MAX_LEVEL) return 'max';
  if (STAGE_MILESTONES.has(level)) return 'stage';
  if (level > 20 && (level - 20) % 5 === 0) return 'star';
  return 'level';
}

function milestoneLabel(level: number): string {
  if (level === 5) return '活力阶段';
  if (level === 10) return '成熟阶段';
  if (level === 20) return '闪耀阶段';
  if (level === 50) return '闪耀六星·圆满';
  return STAR_TITLES[radiantStarsForLevel(level)];
}

export function deriveGrowthMilestones(fromLevel: number, toLevel: number): GrowthMilestone[] {
  const from = normalizedLevel(fromLevel);
  const to = normalizedLevel(toLevel);
  if (to <= from) return [];
  const milestones: GrowthMilestone[] = [];
  for (let level = from + 1; level <= to; level += 1) {
    milestones.push({
      level,
      kind: milestoneKind(level),
      title: levelTitleForLevel(level),
      stage: stageForLevel(level),
      radiantStars: radiantStarsForLevel(level),
    });
  }
  return milestones;
}

export function describeGrowth(level: number): GrowthDescriptor {
  const normalized = normalizedLevel(level);
  const nextMilestoneLevel = MAJOR_MILESTONES.find((milestone) => milestone > normalized) ?? null;
  return {
    level: normalized,
    stage: stageForLevel(normalized),
    title: levelTitleForLevel(normalized),
    radiantStars: radiantStarsForLevel(normalized),
    nextLevelExperience: normalized < MAX_LEVEL ? experienceForNextLevel(normalized) : null,
    nextLevelTitle: normalized < LEGACY_MAX_LEVEL ? levelTitleForLevel(normalized + 1) : null,
    nextMilestoneLevel,
    nextMilestoneLabel: nextMilestoneLevel === null ? null : milestoneLabel(nextMilestoneLevel),
  };
}
