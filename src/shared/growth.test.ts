import { describe, expect, it } from 'vitest';
import {
  cumulativeExperienceForLevel,
  deriveGrowthMilestones,
  describeGrowth,
  experienceForNextLevel,
  LEVEL_TITLES,
  levelTitleForLevel,
  MAX_LEVEL,
  radiantStarsForLevel,
  stageForLevel,
  statCap,
} from './growth';

describe('growth curve and presentation', () => {
  it('uses the exact three-times curve through level 20 and continues to level 50', () => {
    expect(MAX_LEVEL).toBe(50);
    expect(experienceForNextLevel(1)).toBe(300);
    expect(experienceForNextLevel(19)).toBe(3_000);
    expect(experienceForNextLevel(49)).toBe(7_500);
    expect(cumulativeExperienceForLevel(20)).toBe(31_350);
    expect(cumulativeExperienceForLevel(50)).toBe(191_100);
  });

  it('keeps the four stage boundaries and derives six radiant stars', () => {
    expect(stageForLevel(4)).toBe('sprout');
    expect(stageForLevel(5)).toBe('lively');
    expect(stageForLevel(9)).toBe('lively');
    expect(stageForLevel(10)).toBe('mature');
    expect(stageForLevel(19)).toBe('mature');
    expect(stageForLevel(20)).toBe('radiant');
    expect(stageForLevel(50)).toBe('radiant');
    expect(radiantStarsForLevel(24)).toBe(0);
    expect(radiantStarsForLevel(25)).toBe(1);
    expect(radiantStarsForLevel(49)).toBe(5);
    expect(radiantStarsForLevel(50)).toBe(6);
  });

  it('gives every level through 20 a unique title and star titles afterwards', () => {
    const titles = Array.from({ length: 20 }, (_, index) => LEVEL_TITLES[index + 1]);
    expect(titles.every((title) => typeof title === 'string' && title.length > 0)).toBe(true);
    expect(new Set(titles).size).toBe(20);
    expect(levelTitleForLevel(20)).toBe('闪耀新星');
    expect(levelTitleForLevel(25)).toBe('闪耀一星');
    expect(levelTitleForLevel(50)).toBe('闪耀六星·圆满');
  });

  it('uses slower cap growth after level 20', () => {
    expect(statCap(1)).toBe(100);
    expect(statCap(20)).toBe(138);
    expect(statCap(21)).toBe(139);
    expect(statCap(25)).toBe(143);
    expect(statCap(50)).toBe(168);
  });

  it('describes the next milestone and classifies crossed levels once', () => {
    expect(describeGrowth(19)).toMatchObject({
      title: '待耀之星',
      nextLevelExperience: 3_000,
      nextLevelTitle: '闪耀新星',
      nextMilestoneLevel: 20,
      nextMilestoneLabel: '闪耀阶段',
    });
    expect(describeGrowth(20)).toMatchObject({
      radiantStars: 0,
      nextMilestoneLevel: 25,
      nextMilestoneLabel: '闪耀一星',
    });
    expect(describeGrowth(50)).toMatchObject({
      nextLevelExperience: null,
      nextMilestoneLevel: null,
      nextMilestoneLabel: null,
    });

    const milestones = deriveGrowthMilestones(19, 25);
    expect(milestones.map(({ level, kind }) => [level, kind])).toEqual([
      [20, 'stage'],
      [21, 'level'],
      [22, 'level'],
      [23, 'level'],
      [24, 'level'],
      [25, 'star'],
    ]);
    expect(deriveGrowthMilestones(49, 50)[0]).toMatchObject({ kind: 'max', radiantStars: 6 });
  });
});
