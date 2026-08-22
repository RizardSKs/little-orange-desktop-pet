import { describe, expect, it } from 'vitest';
import type { SaveDataV1 } from './types';
import {
  addExperience,
  advanceOnline,
  applyDecay,
  buyItem,
  createDefaultSave,
  experienceForNextLevel,
  MAX_OFFLINE_MS,
  migrateSaveV1ToV2,
  performAction,
  settleOffline,
  stageForLevel,
  statCap,
  validateLegacySave,
  validateSave,
} from './game';

const legacySave = (): SaveDataV1 => ({
  schemaVersion: 1,
  pet: {
    name: '旧版橙子',
    behavior: 'idle',
    stats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
    lastUpdatedAt: 1_000,
  },
  growth: { level: 19, experience: 500, stage: 'sprout', totalOnlineMs: 123_000, rewardRemainderMs: 45_000 },
  economy: { coins: 4_321, ownedItems: ['leaf-clip', 'halo'], equippedItem: 'halo' },
  settings: {
    autoWalk: false,
    alwaysOnTop: true,
    launchAtLogin: true,
    animationIntensity: 'gentle',
    petPosition: { x: -120, y: 240 },
  },
});

describe('growth rules', () => {
  it('uses the new curve and keeps the four stage thresholds', () => {
    expect(experienceForNextLevel(1)).toBe(300);
    expect(experienceForNextLevel(10)).toBe(1_650);
    expect(stageForLevel(1)).toBe('sprout');
    expect(stageForLevel(5)).toBe('lively');
    expect(stageForLevel(10)).toBe('mature');
    expect(stageForLevel(20)).toBe('radiant');
    expect(statCap(20)).toBe(138);
    expect(statCap(50)).toBe(168);
  });

  it('levels repeatedly through level 20 and stops at level 50', () => {
    let state = createDefaultSave(0);
    state = addExperience(state, 300);
    expect(state.growth.level).toBe(2);
    expect(state.growth.experience).toBe(0);

    state.growth.level = 19;
    state.growth.stage = 'mature';
    state.growth.experience = 0;
    state = addExperience(state, experienceForNextLevel(19));
    expect(state.growth).toMatchObject({ level: 20, experience: 0, stage: 'radiant' });
    state = addExperience(state, experienceForNextLevel(20));
    expect(state.growth.level).toBe(21);

    state.growth.level = 49;
    state.growth.experience = 0;
    state = addExperience(state, experienceForNextLevel(49) + 999);
    expect(state.growth).toMatchObject({ level: 50, experience: 0, stage: 'radiant' });
    expect(addExperience(state, 999).growth.experience).toBe(0);
    expect(addExperience(state, Number.POSITIVE_INFINITY).growth.level).toBe(50);
  });
});

describe('time and reward rules', () => {
  it('decays awake stats and restores sleeping energy', () => {
    const stats = { satiety: 90, mood: 90, energy: 90, cleanliness: 90 };
    expect(applyDecay(stats, 60 * 60 * 1000, false, 100)).toEqual({ satiety: 88, mood: 88.5, energy: 87, cleanliness: 89 });
    expect(applyDecay(stats, 60 * 60 * 1000, true, 100).energy).toBe(100);
  });

  it('preserves partial online reward time and pays each five minutes', () => {
    let state = createDefaultSave(0);
    state = advanceOnline(state, 4 * 60 * 1000);
    expect(state.economy.coins).toBe(30);
    expect(state.growth.rewardRemainderMs).toBe(4 * 60 * 1000);
    state = advanceOnline(state, 6 * 60 * 1000);
    expect(state.economy.coins).toBeGreaterThan(30);
    expect(state.growth.experience).toBe(1);
  });

  it('caps offline decay at eight hours and grants no offline rewards', () => {
    const state = createDefaultSave(10_000);
    state.growth.rewardRemainderMs = 123_000;
    state.growth.totalOnlineMs = 456_000;
    const rollback = settleOffline(state, 9_000);
    expect(rollback.summary).toEqual({
      elapsedMs: 0,
      beforeStats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
      afterStats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
    });

    const now = 24 * 60 * 60 * 1000 + 10_000;
    const settled = settleOffline(state, now);
    expect(settled.summary).toEqual({
      elapsedMs: MAX_OFFLINE_MS,
      beforeStats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
      afterStats: { satiety: 74, mood: 78, energy: 66, cleanliness: 82 },
    });
    expect(settled.state.economy.coins).toBe(state.economy.coins);
    expect(settled.state.growth.experience).toBe(state.growth.experience);
    expect(settled.state.growth.rewardRemainderMs).toBe(123_000);
    expect(settled.state.growth.totalOnlineMs).toBe(456_000);
    expect(settled.state.pet.stats).toEqual({ satiety: 74, mood: 78, energy: 66, cleanliness: 82 });
    expect(settled.state.pet.lastUpdatedAt).toBe(now);
  });
});

describe('interactions and shop', () => {
  it('grants care experience in proportion to actual recovery', () => {
    const state = createDefaultSave(0);
    state.pet.stats.satiety = 75;
    const fed = performAction(state, 'feed', 0).state;
    expect(fed.economy.coins).toBe(25);
    expect(fed.pet.stats.satiety).toBe(100);
    expect(fed.growth.experience).toBe(3);

    const partial = createDefaultSave(0);
    const partiallyFed = performAction(partial, 'feed', 0).state;
    expect(partiallyFed.pet.stats.satiety).toBe(100);
    expect(partiallyFed.growth.experience).toBe(1);

    const playful = createDefaultSave(0);
    playful.pet.stats.mood = 80;
    expect(performAction(playful, 'play', 0).state.growth.experience).toBe(8);
    const dirty = createDefaultSave(0);
    dirty.pet.stats.cleanliness = 70;
    expect(performAction(dirty, 'clean', 0).state.growth.experience).toBe(4);
  });

  it('does not charge resources or grant experience when the target stat is full', () => {
    const state = createDefaultSave(0);
    state.pet.stats = { satiety: 100, mood: 100, energy: 90, cleanliness: 100 };
    for (const action of ['feed', 'play', 'clean'] as const) {
      const result = performAction(state, action, 0).state;
      expect(result.economy.coins).toBe(30);
      expect(result.pet.stats.energy).toBe(90);
      expect(result.growth.experience).toBe(0);
      expect(result.pet.behavior).toBe('idle');
    }
  });

  it('refuses play without energy and enforces outfit ownership rules', () => {
    const state = createDefaultSave(0);
    state.pet.stats.mood = 70;
    state.pet.stats.energy = 2;
    expect(performAction(state, 'play', 0).state.growth.experience).toBe(0);
    expect(buyItem(state, 'crown').ok).toBe(false);
    const bought = buyItem(state, 'leaf-clip');
    expect(bought.ok).toBe(true);
    expect(bought.state.economy.ownedItems).toContain('leaf-clip');
    expect(buyItem(bought.state, 'leaf-clip').ok).toBe(false);
  });
});

describe('save validation and migration', () => {
  it('deeply validates both schemas and preserves legacy progress proportion', () => {
    const legacy = legacySave();
    expect(validateLegacySave(legacy)).toBe(true);
    const migrated = migrateSaveV1ToV2(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.growth).toEqual({ level: 19, experience: 1_500, stage: 'mature', totalOnlineMs: 123_000, rewardRemainderMs: 45_000 });
    expect(migrated.economy).toMatchObject({ coins: 4_321, ownedItems: ['leaf-clip', 'halo'], equippedItem: 'halo', inventory: {}, activeExpedition: null });
    expect(migrated.settings).toMatchObject({
      autoWalk: false,
      petPosition: { x: -120, y: 240 },
      desktopLocked: false,
      mouseInteractionsEnabled: true,
      keyboardInteractionEnabled: false,
      keyboardConsentVersion: 0,
    });
    expect(validateSave(migrated)).toBe(true);
  });

  it('rejects invalid nested values instead of accepting a shallow shape', () => {
    const badLegacy = legacySave();
    badLegacy.growth.experience = 1_000;
    expect(validateLegacySave(badLegacy)).toBe(false);

    const badCurrent = createDefaultSave(0);
    badCurrent.economy.coins = Number.NaN;
    expect(validateSave(badCurrent)).toBe(false);
    badCurrent.economy.coins = 30;
    badCurrent.settings.keyboardInteractionEnabled = true;
    expect(validateSave(badCurrent)).toBe(false);
  });

  it('enforces effect queue and expedition invariants', () => {
    const tooManyEffects = createDefaultSave(0);
    tooManyEffects.economy.effectQueues.theme = Array.from({ length: 33 }, () => ({
      effectId: 'effect-sunset-theme' as const,
      sourceId: 'item-sunset-theme' as const,
      remainingRuntimeMs: 1_000,
    }));
    expect(validateSave(tooManyEffects)).toBe(false);

    const tooMuchRuntime = createDefaultSave(0);
    tooMuchRuntime.economy.effectQueues.theme = [{
      effectId: 'effect-sunset-theme',
      sourceId: 'item-sunset-theme',
      remainingRuntimeMs: 14 * 24 * 60 * 60 * 1_000 + 1,
    }];
    expect(validateSave(tooMuchRuntime)).toBe(false);

    const wrongStory = createDefaultSave(0);
    wrongStory.economy.activeExpedition = {
      expeditionId: 'expedition-neighborhood',
      remainingRuntimeMs: 1_000,
      selectedStoryId: 'story-river-stone',
    };
    expect(validateSave(wrongStory)).toBe(false);

    const conflictingReward = createDefaultSave(0);
    conflictingReward.economy.activeExpedition = {
      expeditionId: 'expedition-neighborhood',
      remainingRuntimeMs: 1_000,
      selectedStoryId: 'story-window-sparrow',
    };
    conflictingReward.economy.pendingExpeditionReward = {
      expeditionId: 'expedition-neighborhood',
      storyId: 'story-window-sparrow',
      completedAt: 1_000,
    };
    expect(validateSave(conflictingReward)).toBe(false);
  });
});
