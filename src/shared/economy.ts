import {
  EFFECT_SLOTS,
  type EconomyActionCode,
  type EconomyActionResult,
  type EconomyState,
  type EffectSlot,
  type ExpeditionId,
  type InventoryItemId,
  type RuntimeAdvanceResult,
  type TimedEffect,
} from './economy-types';
import {
  findExpedition,
  findInventoryItem,
  type EffectGrant,
  type ExpeditionCatalogItem,
  type PetStatKey,
} from './catalog';
import type { PetStats } from './types';

export const MAX_PURCHASE_QUANTITY = 10;
export const MAX_EFFECT_SEGMENTS_PER_SLOT = 32;
export const MAX_EFFECT_RUNTIME_PER_SLOT_MS = 14 * 24 * 60 * 60 * 1000;

type EffectSourceId = InventoryItemId | ExpeditionId;
const PET_STAT_KEYS: readonly PetStatKey[] = ['satiety', 'mood', 'energy', 'cleanliness'];

export type InventoryStatSuccessCode = 'applied' | 'no-stat-effect' | 'already-full';
export type InventoryStatFailureCode = 'invalid-item' | 'invalid-stats' | 'stats-full' | 'insufficient-stat';

interface InventoryStatResultBase {
  message: string;
  stats: PetStats;
}

export type InventoryStatActionResult =
  | (InventoryStatResultBase & { ok: true; code: InventoryStatSuccessCode })
  | (InventoryStatResultBase & { ok: false; code: InventoryStatFailureCode });

function cloneEconomy(economy: EconomyState): EconomyState {
  return {
    ...economy,
    ownedItems: [...economy.ownedItems],
    inventory: { ...economy.inventory },
    effectQueues: {
      celebration: economy.effectQueues.celebration.map((effect) => ({ ...effect })),
      keyboard: economy.effectQueues.keyboard.map((effect) => ({ ...effect })),
      mouse: economy.effectQueues.mouse.map((effect) => ({ ...effect })),
      theme: economy.effectQueues.theme.map((effect) => ({ ...effect })),
      aura: economy.effectQueues.aura.map((effect) => ({ ...effect })),
    },
    activeExpedition: economy.activeExpedition ? { ...economy.activeExpedition } : null,
    travelJournal: [...economy.travelJournal],
    pendingExpeditionReward: economy.pendingExpeditionReward ? { ...economy.pendingExpeditionReward } : null,
  };
}

function actionResult(
  economy: EconomyState,
  ok: boolean,
  code: EconomyActionCode,
  message: string,
): EconomyActionResult {
  return { ok, code, message, economy };
}

function queueRuntime(queue: readonly TimedEffect[]): number {
  return queue.reduce((total, effect) => total + effect.remainingRuntimeMs, 0);
}

function activeExpeditionEffects(economy: EconomyState): readonly EffectGrant[] {
  if (!economy.activeExpedition) return [];
  const expedition = findExpedition(economy.activeExpedition.expeditionId);
  return expedition ? [expedition.completionEffect, expedition.rewardEffect] : [];
}

function canEnqueueEffects(
  economy: EconomyState,
  grants: readonly EffectGrant[],
  reserveActiveExpeditionReward: boolean,
): boolean {
  const additions = new Map<EffectSlot, { segments: number; runtimeMs: number }>();
  const addGrant = (grant: EffectGrant) => {
    const current = additions.get(grant.slot) ?? { segments: 0, runtimeMs: 0 };
    additions.set(grant.slot, {
      segments: current.segments + 1,
      runtimeMs: current.runtimeMs + grant.durationMs,
    });
  };

  grants.forEach(addGrant);
  if (reserveActiveExpeditionReward) {
    activeExpeditionEffects(economy).forEach(addGrant);
  }

  return EFFECT_SLOTS.every((slot) => {
    const queue = economy.effectQueues[slot];
    const addition = additions.get(slot) ?? { segments: 0, runtimeMs: 0 };
    const currentRuntime = queueRuntime(queue);
    return Number.isFinite(currentRuntime)
      && queue.length + addition.segments <= MAX_EFFECT_SEGMENTS_PER_SLOT
      && currentRuntime + addition.runtimeMs <= MAX_EFFECT_RUNTIME_PER_SLOT_MS;
  });
}

function enqueueEffects(
  economy: EconomyState,
  grants: readonly EffectGrant[],
  sourceId: EffectSourceId,
): void {
  for (const grant of grants) {
    economy.effectQueues[grant.slot].push({
      effectId: grant.effectId,
      sourceId,
      remainingRuntimeMs: grant.durationMs,
    });
  }
}

function advanceQueue(queue: readonly TimedEffect[], elapsedRuntimeMs: number): TimedEffect[] {
  const next = queue.map((effect) => ({ ...effect }));
  let remainingElapsed = elapsedRuntimeMs;
  while (remainingElapsed > 0 && next.length > 0) {
    const active = next[0];
    if (active.remainingRuntimeMs <= remainingElapsed) {
      remainingElapsed -= active.remainingRuntimeMs;
      next.shift();
    } else {
      active.remainingRuntimeMs -= remainingElapsed;
      remainingElapsed = 0;
    }
  }
  return next;
}

export function purchaseInventoryItem(
  economy: EconomyState,
  itemId: string,
  quantity: number,
): EconomyActionResult {
  const item = findInventoryItem(itemId);
  if (!item) return actionResult(cloneEconomy(economy), false, 'invalid-item', '找不到这个用品或服务券。');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    return actionResult(cloneEconomy(economy), false, 'invalid-quantity', `单次只能购买 1–${MAX_PURCHASE_QUANTITY} 件。`);
  }

  const currentQuantity = economy.inventory[item.id] ?? 0;
  if (currentQuantity + quantity > item.maxStack) {
    return actionResult(cloneEconomy(economy), false, 'stack-full', `每种物品最多保存 ${item.maxStack} 件。`);
  }

  const totalPrice = item.price * quantity;
  if (!Number.isSafeInteger(totalPrice) || economy.coins < totalPrice) {
    return actionResult(cloneEconomy(economy), false, 'insufficient-coins', '金币不足。');
  }

  const next = cloneEconomy(economy);
  next.coins -= totalPrice;
  next.inventory[item.id] = currentQuantity + quantity;
  return actionResult(next, true, 'purchased', `购买了 ${quantity} 件${item.name}。`);
}

export function useInventoryItem(economy: EconomyState, itemId: string): EconomyActionResult {
  const item = findInventoryItem(itemId);
  if (!item) return actionResult(cloneEconomy(economy), false, 'invalid-item', '找不到这个用品或服务券。');
  const currentQuantity = economy.inventory[item.id] ?? 0;
  if (!Number.isInteger(currentQuantity) || currentQuantity < 1) {
    return actionResult(cloneEconomy(economy), false, 'item-unavailable', '背包里没有这件物品。');
  }
  if (!canEnqueueEffects(economy, item.effects, true)) {
    return actionResult(cloneEconomy(economy), false, 'effect-queue-full', '同类效果已经排得太满，请稍后再使用。');
  }

  const next = cloneEconomy(economy);
  if (currentQuantity === 1) delete next.inventory[item.id];
  else next.inventory[item.id] = currentQuantity - 1;
  enqueueEffects(next, item.effects, item.id);
  return actionResult(next, true, 'used', `已使用${item.name}。`);
}

export function applyInventoryStatEffect(
  stats: PetStats,
  cap: number,
  itemId: string,
): InventoryStatActionResult {
  const item = findInventoryItem(itemId);
  const original = { ...stats };
  if (!item) return { ok: false, code: 'invalid-item', message: '找不到这个用品或服务券。', stats: original };
  if (!Number.isFinite(cap) || cap <= 0
    || PET_STAT_KEYS.some((key) => !Number.isFinite(stats[key]) || stats[key] < 0 || stats[key] > cap)) {
    return { ok: false, code: 'invalid-stats', message: '宠物状态无效，暂时不能使用。', stats: original };
  }
  if (!item.stats) return { ok: true, code: 'no-stat-effect', message: '该物品不改变照顾属性。', stats: original };

  const additions = item.stats.add ?? {};
  for (const key of PET_STAT_KEYS) {
    const amount = additions[key] ?? 0;
    if (!Number.isFinite(amount) || (amount < 0 && stats[key] + amount < 0)) {
      return { ok: false, code: 'insufficient-stat', message: `${item.name}当前还不能使用。`, stats: original };
    }
  }

  const next = { ...stats };
  for (const key of item.stats.fillToCap ?? []) next[key] = cap;
  for (const key of PET_STAT_KEYS) {
    const amount = additions[key] ?? 0;
    next[key] = Math.min(cap, Math.max(0, next[key] + amount));
  }
  const hasBenefit = PET_STAT_KEYS.some((key) => next[key] > stats[key]);
  if (!hasBenefit) {
    if (item.kind === 'service') {
      return {
        ok: true,
        code: 'already-full',
        message: '照顾状态已经满满的，服务仪式和视觉效果仍会照常进行。',
        stats: original,
      };
    }
    return { ok: false, code: 'stats-full', message: '相关状态已经满满的，先留到以后再用吧。', stats: original };
  }
  return { ok: true, code: 'applied', message: `${item.name}的照顾效果已生效。`, stats: next };
}

function selectStory(expedition: ExpeditionCatalogItem, economy: EconomyState, selectionSeed: number) {
  return expedition.storyIds.find((storyId) => !economy.travelJournal.includes(storyId))
    ?? expedition.storyIds[Math.abs(Math.floor(selectionSeed)) % expedition.storyIds.length];
}

export function startExpedition(economy: EconomyState, expeditionId: string, selectionSeed = 0): EconomyActionResult {
  const expedition = findExpedition(expeditionId);
  if (!expedition) return actionResult(cloneEconomy(economy), false, 'invalid-expedition', '找不到这个探索委托。');
  if (economy.activeExpedition) {
    return actionResult(cloneEconomy(economy), false, 'expedition-active', '小橙子已经在旅行中了。');
  }
  if (economy.pendingExpeditionReward) {
    return actionResult(cloneEconomy(economy), false, 'reward-pending', '请先看看小橙子带回来的旅行故事。');
  }
  if (economy.coins < expedition.price) {
    return actionResult(cloneEconomy(economy), false, 'insufficient-coins', '金币不足。');
  }
  if (!canEnqueueEffects(economy, [expedition.completionEffect, expedition.rewardEffect], false)) {
    return actionResult(cloneEconomy(economy), false, 'effect-queue-full', '返程效果队列已满，暂时无法出发。');
  }

  const selectedStoryId = selectStory(expedition, economy, Number.isFinite(selectionSeed) ? selectionSeed : 0);
  const next = cloneEconomy(economy);
  next.coins -= expedition.price;
  next.activeExpedition = {
    expeditionId: expedition.id,
    remainingRuntimeMs: expedition.durationRuntimeMs,
    selectedStoryId,
  };
  return actionResult(next, true, 'expedition-started', `${expedition.name}开始啦！`);
}

export function returnExpeditionEarly(economy: EconomyState): EconomyActionResult {
  if (!economy.activeExpedition) {
    return actionResult(cloneEconomy(economy), false, 'no-active-expedition', '当前没有进行中的探索。');
  }
  const expedition = findExpedition(economy.activeExpedition.expeditionId);
  const next = cloneEconomy(economy);
  next.activeExpedition = null;
  return actionResult(next, true, 'expedition-returned', `${expedition?.name ?? '探索'}已提前结束，不发放返程奖励。`);
}

export function acknowledgeExpeditionReward(economy: EconomyState): EconomyActionResult {
  if (!economy.pendingExpeditionReward) {
    return actionResult(cloneEconomy(economy), false, 'no-pending-reward', '当前没有待确认的旅行故事。');
  }
  const next = cloneEconomy(economy);
  next.pendingExpeditionReward = null;
  return actionResult(next, true, 'reward-acknowledged', '旅行故事已收进旅行册。');
}

export function advanceEconomyRuntime(
  economy: EconomyState,
  elapsedRuntimeMs: number,
  completedAt: number,
): RuntimeAdvanceResult {
  if (!Number.isFinite(elapsedRuntimeMs) || elapsedRuntimeMs < 0
    || !Number.isFinite(completedAt) || completedAt < 0) {
    return {
      ...actionResult(cloneEconomy(economy), false, 'invalid-runtime', '运行时间无效。'),
      completedExpedition: false,
    };
  }

  const elapsed = Math.floor(elapsedRuntimeMs);
  const next = cloneEconomy(economy);
  for (const slot of EFFECT_SLOTS) next.effectQueues[slot] = advanceQueue(next.effectQueues[slot], elapsed);

  let completedExpedition = false;
  const active = next.activeExpedition;
  if (active && elapsed >= active.remainingRuntimeMs) {
    const expedition = findExpedition(active.expeditionId);
    if (expedition && !next.pendingExpeditionReward
      && canEnqueueEffects(next, [expedition.completionEffect, expedition.rewardEffect], false)) {
      enqueueEffects(next, [expedition.completionEffect, expedition.rewardEffect], expedition.id);
      if (!next.travelJournal.includes(active.selectedStoryId)) next.travelJournal.push(active.selectedStoryId);
      next.pendingExpeditionReward = {
        expeditionId: active.expeditionId,
        storyId: active.selectedStoryId,
        completedAt: Math.floor(completedAt),
      };
      next.activeExpedition = null;
      completedExpedition = true;
    } else {
      active.remainingRuntimeMs = 1;
    }
  } else if (active) {
    active.remainingRuntimeMs -= elapsed;
  }

  return {
    ...actionResult(
      next,
      true,
      completedExpedition ? 'expedition-completed' : 'advanced',
      completedExpedition ? '小橙子旅行归来，带回了一篇新故事！' : '运行时间已推进。',
    ),
    completedExpedition,
  };
}

export const activeEffectForSlot = (economy: EconomyState, slot: EffectSlot): TimedEffect | null =>
  economy.effectQueues[slot][0] ?? null;
