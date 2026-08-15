import { findShopItem } from './catalog';
import type { GrowthStage, OfflineSummary, PetAction, PetStats, SaveData } from './types';

export const MAX_LEVEL = 20;
export const REWARD_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function stageForLevel(level: number): GrowthStage {
  if (level >= 20) return 'radiant';
  if (level >= 10) return 'mature';
  if (level >= 5) return 'lively';
  return 'sprout';
}

export const experienceForNextLevel = (level: number) => 100 + (level - 1) * 50;
export const statCap = (level: number) => 100 + Math.max(0, Math.min(MAX_LEVEL, level) - 1) * 2;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundStat = (value: number) => Math.round(value * 100) / 100;

export function createDefaultSave(now = Date.now()): SaveData {
  return {
    schemaVersion: 1,
    pet: {
      name: '小橙子', behavior: 'idle', lastUpdatedAt: now,
      stats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
    },
    growth: { level: 1, experience: 0, stage: 'sprout', totalOnlineMs: 0, rewardRemainderMs: 0 },
    economy: { coins: 30, ownedItems: [], equippedItem: null },
    settings: { autoWalk: true, alwaysOnTop: true, launchAtLogin: false, animationIntensity: 'normal', petPosition: null },
  };
}

function copyState(state: SaveData): SaveData {
  return JSON.parse(JSON.stringify(state)) as SaveData;
}

export function applyDecay(stats: PetStats, elapsedMs: number, sleeping: boolean, cap: number): PetStats {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return { ...stats };
  const hours = elapsedMs / HOUR_MS;
  return {
    satiety: roundStat(clamp(stats.satiety - 2 * hours, 0, cap)),
    mood: roundStat(clamp(stats.mood - 1.5 * hours, 0, cap)),
    energy: roundStat(clamp(stats.energy + (sleeping ? 12 : -3) * hours, 0, cap)),
    cleanliness: roundStat(clamp(stats.cleanliness - 1 * hours, 0, cap)),
  };
}

export function rewardEfficiency(state: SaveData): number {
  const cap = statCap(state.growth.level);
  const values = Object.values(state.pet.stats);
  const averageRatio = values.reduce((sum, value) => sum + clamp(value / cap, 0, 1), 0) / values.length;
  return 0.5 + averageRatio * 0.7;
}

export function addExperience(state: SaveData, amount: number): SaveData {
  const next = copyState(state);
  if (amount <= 0 || next.growth.level >= MAX_LEVEL) return next;
  next.growth.experience += amount;
  while (next.growth.level < MAX_LEVEL) {
    const required = experienceForNextLevel(next.growth.level);
    if (next.growth.experience < required) break;
    next.growth.experience -= required;
    next.growth.level += 1;
    next.growth.stage = stageForLevel(next.growth.level);
  }
  if (next.growth.level >= MAX_LEVEL) next.growth.experience = 0;
  return next;
}

export function advanceOnline(state: SaveData, now: number): SaveData {
  if (!Number.isFinite(now) || now <= state.pet.lastUpdatedAt) return copyState(state);
  const elapsed = now - state.pet.lastUpdatedAt;
  let next = copyState(state);
  next.pet.stats = applyDecay(next.pet.stats, elapsed, next.pet.behavior === 'sleeping', statCap(next.growth.level));
  next.growth.totalOnlineMs += elapsed;
  const rewardTime = next.growth.rewardRemainderMs + elapsed;
  const units = Math.floor(rewardTime / REWARD_INTERVAL_MS);
  next.growth.rewardRemainderMs = rewardTime % REWARD_INTERVAL_MS;
  next.pet.lastUpdatedAt = now;
  if (units > 0) {
    const efficiency = rewardEfficiency(next);
    next.economy.coins += Math.max(1, Math.floor(units * 2 * efficiency));
    next = addExperience(next, Math.max(1, Math.floor(units * efficiency)));
  }
  return next;
}

export function settleOffline(state: SaveData, now: number): { state: SaveData; summary: OfflineSummary } {
  if (!Number.isFinite(now) || now <= state.pet.lastUpdatedAt) {
    return { state: copyState(state), summary: { elapsedMs: 0, coins: 0, experience: 0 } };
  }
  const elapsed = Math.min(now - state.pet.lastUpdatedAt, MAX_OFFLINE_MS);
  let next = copyState(state);
  next.pet.stats = applyDecay(next.pet.stats, elapsed, next.pet.behavior === 'sleeping', statCap(next.growth.level));
  next.pet.lastUpdatedAt = now;
  const units = Math.floor(elapsed / REWARD_INTERVAL_MS);
  const efficiency = rewardEfficiency(next);
  const coins = Math.floor(units * 2 * efficiency * 0.7);
  const experience = next.growth.level >= MAX_LEVEL ? 0 : Math.floor(units * efficiency * 0.7);
  next.economy.coins += coins;
  next = addExperience(next, experience);
  return { state: next, summary: { elapsedMs: elapsed, coins, experience } };
}

export function performAction(state: SaveData, action: PetAction, now = Date.now()): { state: SaveData; message: string } {
  let next = advanceOnline(state, now);
  const cap = statCap(next.growth.level);
  if (action === 'feed') {
    if (next.economy.coins < 5) return { state: next, message: '金币不足，挂机一会儿再来吧。' };
    next.economy.coins -= 5;
    next.pet.stats.satiety = clamp(next.pet.stats.satiety + 25, 0, cap);
    next.pet.behavior = 'eating';
    next = addExperience(next, 3);
    return { state: next, message: '小橙子吃得好满足！' };
  }
  if (action === 'play') {
    if (next.pet.stats.energy < 8) return { state: next, message: '小橙子太困了，先睡一会儿吧。' };
    next.pet.stats.mood = clamp(next.pet.stats.mood + 20, 0, cap);
    next.pet.stats.energy = clamp(next.pet.stats.energy - 8, 0, cap);
    next.pet.behavior = 'playing';
    next = addExperience(next, 8);
    return { state: next, message: '一起玩真开心！' };
  }
  if (action === 'clean') {
    next.pet.stats.cleanliness = clamp(next.pet.stats.cleanliness + 30, 0, cap);
    next.pet.behavior = 'cleaning';
    next = addExperience(next, 4);
    return { state: next, message: '洗得亮晶晶！' };
  }
  next.pet.behavior = next.pet.behavior === 'sleeping' ? 'idle' : 'sleeping';
  return { state: next, message: next.pet.behavior === 'sleeping' ? '晚安，小橙子。' : '睡醒啦！' };
}

export function buyItem(state: SaveData, itemId: string): { state: SaveData; ok: boolean; message: string } {
  const next = copyState(state);
  const item = findShopItem(itemId);
  if (!item) return { state: next, ok: false, message: '找不到这个装扮。' };
  if (next.economy.ownedItems.includes(itemId)) return { state: next, ok: false, message: '已经拥有这个装扮。' };
  if (next.growth.level < item.unlockLevel) return { state: next, ok: false, message: `需要达到 ${item.unlockLevel} 级。` };
  if (next.economy.coins < item.price) return { state: next, ok: false, message: '金币不足。' };
  next.economy.coins -= item.price;
  next.economy.ownedItems.push(itemId);
  return { state: next, ok: true, message: `获得了${item.name}！` };
}

export function validateSave(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SaveData>;
  return data.schemaVersion === 1 && !!data.pet && !!data.growth && !!data.economy && !!data.settings
    && typeof data.pet.name === 'string' && data.pet.name.length > 0 && data.pet.name.length <= 12
    && Number.isFinite(data.pet.lastUpdatedAt) && Number.isInteger(data.growth.level)
    && data.growth.level >= 1 && data.growth.level <= MAX_LEVEL && Array.isArray(data.economy.ownedItems);
}
