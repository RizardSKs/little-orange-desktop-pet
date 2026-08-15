import { describe, expect, it } from 'vitest';
import { addExperience, advanceOnline, applyDecay, buyItem, createDefaultSave, experienceForNextLevel, MAX_OFFLINE_MS, performAction, settleOffline, stageForLevel, statCap } from './game';

describe('growth rules', () => {
  it('uses the documented level curve and stages', () => {
    expect(experienceForNextLevel(1)).toBe(100);
    expect(experienceForNextLevel(10)).toBe(550);
    expect(stageForLevel(1)).toBe('sprout');
    expect(stageForLevel(5)).toBe('lively');
    expect(stageForLevel(10)).toBe('mature');
    expect(stageForLevel(20)).toBe('radiant');
    expect(statCap(20)).toBe(138);
  });

  it('levels repeatedly and stops experience at level 20', () => {
    let state = createDefaultSave(0);
    state = addExperience(state, 100);
    expect(state.growth.level).toBe(2);
    expect(state.growth.experience).toBe(0);
    state.growth.level = 19;
    state.growth.experience = 0;
    state = addExperience(state, experienceForNextLevel(19));
    expect(state.growth.level).toBe(20);
    expect(state.growth.experience).toBe(0);
    expect(addExperience(state, 999).growth.experience).toBe(0);
  });
});

describe('time and reward rules', () => {
  it('decays awake stats and restores sleeping energy', () => {
    const stats = { satiety: 90, mood: 90, energy: 90, cleanliness: 90 };
    expect(applyDecay(stats, 60 * 60 * 1000, false, 100)).toEqual({ satiety: 88, mood: 88.5, energy: 87, cleanliness: 89 });
    expect(applyDecay(stats, 60 * 60 * 1000, true, 100).energy).toBe(100);
  });

  it('preserves partial reward time and pays each five minutes', () => {
    let state = createDefaultSave(0);
    state = advanceOnline(state, 4 * 60 * 1000);
    expect(state.economy.coins).toBe(30);
    expect(state.growth.rewardRemainderMs).toBe(4 * 60 * 1000);
    state = advanceOnline(state, 6 * 60 * 1000);
    expect(state.economy.coins).toBeGreaterThan(30);
    expect(state.growth.experience).toBe(1);
  });

  it('caps offline settlement at eight hours and rejects clock rollback', () => {
    const state = createDefaultSave(10_000);
    const rollback = settleOffline(state, 9_000);
    expect(rollback.summary).toEqual({ elapsedMs: 0, coins: 0, experience: 0 });
    const settled = settleOffline(state, 24 * 60 * 60 * 1000 + 10_000);
    expect(settled.summary.elapsedMs).toBe(MAX_OFFLINE_MS);
    expect(settled.summary.coins).toBeGreaterThan(0);
    expect(settled.state.pet.lastUpdatedAt).toBe(24 * 60 * 60 * 1000 + 10_000);
  });
});

describe('interactions and shop', () => {
  it('charges feeding and refuses play without energy', () => {
    const state = createDefaultSave(0);
    const fed = performAction(state, 'feed', 0).state;
    expect(fed.economy.coins).toBe(25);
    expect(fed.pet.stats.satiety).toBe(100);
    expect(fed.growth.experience).toBe(3);
    fed.pet.stats.energy = 2;
    expect(performAction(fed, 'play', 0).state.growth.experience).toBe(3);
  });

  it('enforces level, ownership and price for shop items', () => {
    const state = createDefaultSave(0);
    expect(buyItem(state, 'crown').ok).toBe(false);
    const bought = buyItem(state, 'leaf-clip');
    expect(bought.ok).toBe(true);
    expect(bought.state.economy.ownedItems).toContain('leaf-clip');
    expect(buyItem(bought.state, 'leaf-clip').ok).toBe(false);
  });
});
