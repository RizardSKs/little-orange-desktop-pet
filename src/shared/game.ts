import {
  EFFECT_SLOTS,
  createDefaultEconomyState,
  isEffectId,
  isExpeditionId,
  isInventoryItemId,
  isStoryId,
} from './economy-types';
import { MAX_EFFECT_RUNTIME_PER_SLOT_MS, MAX_EFFECT_SEGMENTS_PER_SLOT } from './economy';
import { findExpedition, findShopItem, SHOP_ITEMS } from './catalog';
import {
  experienceForNextLevel,
  legacyExperienceForNextLevel,
  LEGACY_EXPERIENCE_SCALE,
  LEGACY_MAX_LEVEL,
  MAX_LEVEL,
  stageForLevel,
  statCap,
} from './growth';
import type {
  ActiveExpedition,
  EconomyState,
  EffectQueues,
  PendingExpeditionReward,
  TimedEffect,
} from './economy-types';
import type {
  AnimationIntensity,
  AppSettings,
  GrowthState,
  LegacyEconomyState,
  OfflineSummary,
  PetAction,
  PetBehavior,
  PetPosition,
  PetState,
  PetStats,
  SaveData,
  SaveDataV1,
  WalkActivity,
} from './types';

export {
  cumulativeExperienceForLevel,
  describeGrowth,
  deriveGrowthMilestones,
  experienceForNextLevel,
  levelTitleForLevel,
  MAX_LEVEL,
  radiantStarsForLevel,
  stageForLevel,
  statCap,
} from './growth';

export const REWARD_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;
export const KEYBOARD_CONSENT_VERSION = 1;
const HOUR_MS = 60 * 60 * 1000;
const STABLE_OUTFIT_IDS = new Set(SHOP_ITEMS.map((item) => item.id));
const PET_BEHAVIORS = new Set<PetBehavior>(['idle', 'walking', 'eating', 'playing', 'cleaning', 'sleeping', 'sad']);
const ANIMATION_INTENSITIES = new Set<AnimationIntensity>(['gentle', 'normal', 'lively']);
const WALK_ACTIVITIES = new Set<WalkActivity>(['quiet', 'normal', 'active']);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundStat = (value: number) => Math.round(value * 100) / 100;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isSafeNonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isFiniteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function createDefaultSave(now = Date.now()): SaveData {
  return {
    schemaVersion: 2,
    pet: {
      name: '小橙子', behavior: 'idle', lastUpdatedAt: now,
      stats: { satiety: 90, mood: 90, energy: 90, cleanliness: 90 },
    },
    growth: { level: 1, experience: 0, stage: 'sprout', totalOnlineMs: 0, rewardRemainderMs: 0 },
    economy: createDefaultEconomyState(),
    settings: {
      autoWalk: true,
      alwaysOnTop: true,
      launchAtLogin: false,
      animationIntensity: 'normal',
      walkActivity: 'quiet',
      petPosition: null,
      desktopLocked: false,
      mouseInteractionsEnabled: true,
      keyboardInteractionEnabled: false,
      keyboardConsentVersion: 0,
    },
  };
}

function copyState<T>(state: T): T {
  return structuredClone(state);
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
  next.growth.stage = stageForLevel(next.growth.level);
  if (!Number.isSafeInteger(amount) || amount <= 0 || next.growth.level >= MAX_LEVEL) {
    if (next.growth.level >= MAX_LEVEL) next.growth.experience = 0;
    return next;
  }
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
    const unchanged = copyState(state);
    return {
      state: unchanged,
      summary: { elapsedMs: 0, beforeStats: { ...state.pet.stats }, afterStats: { ...unchanged.pet.stats } },
    };
  }
  const elapsed = Math.min(now - state.pet.lastUpdatedAt, MAX_OFFLINE_MS);
  const next = copyState(state);
  next.pet.stats = applyDecay(next.pet.stats, elapsed, next.pet.behavior === 'sleeping', statCap(next.growth.level));
  next.pet.lastUpdatedAt = now;
  return {
    state: next,
    summary: { elapsedMs: elapsed, beforeStats: { ...state.pet.stats }, afterStats: { ...next.pet.stats } },
  };
}

const proportionalExperience = (baseExperience: number, actualGain: number, nominalGain: number): number =>
  Math.floor(baseExperience * clamp(actualGain / nominalGain, 0, 1));

export function performAction(state: SaveData, action: PetAction, now = Date.now()): { state: SaveData; message: string } {
  let next = advanceOnline(state, now);
  const cap = statCap(next.growth.level);
  if (action === 'feed') {
    const gain = Math.min(25, Math.max(0, cap - next.pet.stats.satiety));
    if (gain <= 0) return { state: next, message: '小橙子已经吃得饱饱的。' };
    if (next.economy.coins < 5) return { state: next, message: '金币不足，先攒些金币再来吧。' };
    const experience = proportionalExperience(3, gain, 25);
    next.economy.coins -= 5;
    next.pet.stats.satiety = roundStat(next.pet.stats.satiety + gain);
    next.pet.behavior = 'eating';
    next = addExperience(next, experience);
    return { state: next, message: `小橙子恢复了 ${roundStat(gain)} 点饱食度，获得 ${experience} 点经验。` };
  }
  if (action === 'play') {
    const gain = Math.min(20, Math.max(0, cap - next.pet.stats.mood));
    if (gain <= 0) return { state: next, message: '小橙子现在已经非常开心啦。' };
    if (next.pet.stats.energy < 8) return { state: next, message: '小橙子太困了，先睡一会儿吧。' };
    const experience = proportionalExperience(8, gain, 20);
    next.pet.stats.mood = roundStat(next.pet.stats.mood + gain);
    next.pet.stats.energy = roundStat(clamp(next.pet.stats.energy - 8, 0, cap));
    next.pet.behavior = 'playing';
    next = addExperience(next, experience);
    return { state: next, message: `小橙子恢复了 ${roundStat(gain)} 点心情，获得 ${experience} 点经验。` };
  }
  if (action === 'clean') {
    const gain = Math.min(30, Math.max(0, cap - next.pet.stats.cleanliness));
    if (gain <= 0) return { state: next, message: '小橙子已经亮晶晶啦。' };
    const experience = proportionalExperience(4, gain, 30);
    next.pet.stats.cleanliness = roundStat(next.pet.stats.cleanliness + gain);
    next.pet.behavior = 'cleaning';
    next = addExperience(next, experience);
    return { state: next, message: `小橙子恢复了 ${roundStat(gain)} 点清洁度，获得 ${experience} 点经验。` };
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

function validatePet(value: unknown, level: number): value is PetState {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.length < 1 || value.name.length > 12) return false;
  if (typeof value.behavior !== 'string' || !PET_BEHAVIORS.has(value.behavior as PetBehavior)) return false;
  const stats = value.stats;
  if (!isSafeNonNegativeInteger(value.lastUpdatedAt) || !isRecord(stats)) return false;
  const cap = statCap(level);
  return ['satiety', 'mood', 'energy', 'cleanliness'].every((key) => {
    const stat = stats[key];
    return isFiniteNonNegative(stat) && stat <= cap;
  });
}

function validateGrowth(value: unknown, legacy: boolean): value is GrowthState {
  if (!isRecord(value) || !Number.isInteger(value.level)) return false;
  const maxLevel = legacy ? LEGACY_MAX_LEVEL : MAX_LEVEL;
  const level = value.level as number;
  if (level < 1 || level > maxLevel || !isSafeNonNegativeInteger(value.experience)) return false;
  const experience = value.experience as number;
  const validExperience = level === maxLevel
    ? experience === 0
    : experience < (legacy ? legacyExperienceForNextLevel(level) : experienceForNextLevel(level));
  if (!validExperience || !isSafeNonNegativeInteger(value.totalOnlineMs)) return false;
  if (!isSafeNonNegativeInteger(value.rewardRemainderMs) || (value.rewardRemainderMs as number) >= REWARD_INTERVAL_MS) return false;
  if (!['sprout', 'lively', 'mature', 'radiant'].includes(value.stage as string)) return false;
  return legacy || value.stage === stageForLevel(level);
}

function validateOwnedOutfits(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !STABLE_OUTFIT_IDS.has(id))) return false;
  return new Set(value).size === value.length;
}

function validateLegacyEconomy(value: unknown): value is LegacyEconomyState {
  if (!isRecord(value) || !isSafeNonNegativeInteger(value.coins) || !validateOwnedOutfits(value.ownedItems)) return false;
  return value.equippedItem === null
    || (typeof value.equippedItem === 'string' && STABLE_OUTFIT_IDS.has(value.equippedItem) && value.ownedItems.includes(value.equippedItem));
}

function validateTimedEffect(value: unknown): value is TimedEffect {
  if (!isRecord(value) || !isEffectId(value.effectId) || !isSafeNonNegativeInteger(value.remainingRuntimeMs) || value.remainingRuntimeMs === 0) return false;
  return isInventoryItemId(value.sourceId) || isExpeditionId(value.sourceId);
}

function validateEffectQueues(value: unknown): value is EffectQueues {
  if (!isRecord(value) || Object.keys(value).length !== EFFECT_SLOTS.length) return false;
  return EFFECT_SLOTS.every((slot) => {
    const queue = value[slot];
    return Array.isArray(queue)
      && queue.length <= MAX_EFFECT_SEGMENTS_PER_SLOT
      && queue.every(validateTimedEffect)
      && queue.reduce((total, effect) => total + effect.remainingRuntimeMs, 0) <= MAX_EFFECT_RUNTIME_PER_SLOT_MS;
  });
}

function validateActiveExpedition(value: unknown): value is ActiveExpedition | null {
  if (value === null) return true;
  if (!isRecord(value) || !isExpeditionId(value.expeditionId)) return false;
  const expedition = findExpedition(value.expeditionId);
  return !!expedition
    && isSafeNonNegativeInteger(value.remainingRuntimeMs)
    && value.remainingRuntimeMs > 0
    && isStoryId(value.selectedStoryId)
    && expedition.storyIds.includes(value.selectedStoryId);
}

function validatePendingReward(value: unknown): value is PendingExpeditionReward | null {
  if (value === null) return true;
  if (!isRecord(value) || !isExpeditionId(value.expeditionId) || !isStoryId(value.storyId)) return false;
  const expedition = findExpedition(value.expeditionId);
  return !!expedition
    && expedition.storyIds.includes(value.storyId)
    && isSafeNonNegativeInteger(value.completedAt);
}

function validateEconomy(value: unknown): value is EconomyState {
  if (!isRecord(value) || !validateLegacyEconomy(value)) return false;
  const economy = value as unknown as EconomyState;
  if (!isRecord(economy.inventory) || Array.isArray(economy.inventory)) return false;
  if (!Object.entries(economy.inventory).every(([id, count]) => isInventoryItemId(id) && Number.isSafeInteger(count) && (count as number) >= 1 && (count as number) <= 99)) return false;
  if (!validateEffectQueues(economy.effectQueues) || !validateActiveExpedition(economy.activeExpedition)) return false;
  if (!Array.isArray(economy.travelJournal) || economy.travelJournal.some((story) => !isStoryId(story))) return false;
  if (new Set(economy.travelJournal).size !== economy.travelJournal.length) return false;
  if (!validatePendingReward(economy.pendingExpeditionReward)) return false;
  return economy.activeExpedition === null || economy.pendingExpeditionReward === null;
}

function validatePosition(value: unknown): value is PetPosition | null {
  return value === null || (isRecord(value) && typeof value.x === 'number' && Number.isFinite(value.x) && typeof value.y === 'number' && Number.isFinite(value.y));
}

function validateLegacySettings(value: unknown): value is SaveDataV1['settings'] {
  return isRecord(value)
    && typeof value.autoWalk === 'boolean'
    && typeof value.alwaysOnTop === 'boolean'
    && typeof value.launchAtLogin === 'boolean'
    && typeof value.animationIntensity === 'string'
    && ANIMATION_INTENSITIES.has(value.animationIntensity as AnimationIntensity)
    && validatePosition(value.petPosition);
}

function validateSettings(value: unknown): value is AppSettings {
  if (!validateLegacySettings(value)) return false;
  const settings = value as unknown as AppSettings;
  if (typeof settings.walkActivity !== 'string' || !WALK_ACTIVITIES.has(settings.walkActivity as WalkActivity)) return false;
  if (typeof settings.desktopLocked !== 'boolean' || typeof settings.mouseInteractionsEnabled !== 'boolean' || typeof settings.keyboardInteractionEnabled !== 'boolean') return false;
  if (!Number.isSafeInteger(settings.keyboardConsentVersion) || settings.keyboardConsentVersion < 0 || settings.keyboardConsentVersion > KEYBOARD_CONSENT_VERSION) return false;
  return !settings.keyboardInteractionEnabled || settings.keyboardConsentVersion === KEYBOARD_CONSENT_VERSION;
}

export function applyCurrentSettingsDefaults(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.settings) || 'walkActivity' in value.settings) return value;
  return { ...value, settings: { ...value.settings, walkActivity: 'quiet' } };
}

export function validateLegacySave(value: unknown): value is SaveDataV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.growth) || !Number.isInteger(value.growth.level)) return false;
  const level = value.growth.level as number;
  return validateGrowth(value.growth, true)
    && validatePet(value.pet, level)
    && validateLegacyEconomy(value.economy)
    && validateLegacySettings(value.settings);
}

export function validateSave(value: unknown): value is SaveData {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.growth) || !Number.isInteger(value.growth.level)) return false;
  const level = value.growth.level as number;
  return validateGrowth(value.growth, false)
    && validatePet(value.pet, level)
    && validateEconomy(value.economy)
    && validateSettings(value.settings);
}

export function migrateSaveV1ToV2(legacy: SaveDataV1): SaveData {
  if (!validateLegacySave(legacy)) throw new Error('无法迁移无效的 schema 1 存档。');
  const economy = createDefaultEconomyState();
  economy.coins = legacy.economy.coins;
  economy.ownedItems = [...legacy.economy.ownedItems];
  economy.equippedItem = legacy.economy.equippedItem;
  const migrated: SaveData = {
    schemaVersion: 2,
    pet: copyState(legacy.pet),
    growth: {
      ...legacy.growth,
      experience: legacy.growth.level < LEGACY_MAX_LEVEL
        ? legacy.growth.experience * LEGACY_EXPERIENCE_SCALE
        : 0,
      stage: stageForLevel(legacy.growth.level),
    },
    economy,
    settings: {
      ...copyState(legacy.settings),
      walkActivity: 'quiet',
      desktopLocked: false,
      mouseInteractionsEnabled: true,
      keyboardInteractionEnabled: false,
      keyboardConsentVersion: 0,
    },
  };
  if (!validateSave(migrated)) throw new Error('schema 1 存档迁移结果无效。');
  return migrated;
}
