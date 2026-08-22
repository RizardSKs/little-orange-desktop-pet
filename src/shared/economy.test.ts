import { describe, expect, it } from 'vitest';
import {
  acknowledgeExpeditionReward,
  advanceEconomyRuntime,
  applyInventoryStatEffect,
  MAX_EFFECT_RUNTIME_PER_SLOT_MS,
  MAX_EFFECT_SEGMENTS_PER_SLOT,
  purchaseInventoryItem,
  returnExpeditionEarly,
  startExpedition,
  useInventoryItem,
} from './economy';
import { createDefaultEconomyState, type EconomyState } from './economy-types';

const withCoins = (coins: number): EconomyState => ({ ...createDefaultEconomyState(), coins });

describe('inventory purchases and use', () => {
  it('purchases supplies and service vouchers atomically without auto-using them', () => {
    const original = withCoins(1_000);
    const supply = purchaseInventoryItem(original, 'item-citrus-cookie', 3);
    expect(supply.ok).toBe(true);
    expect(supply.economy.coins).toBe(964);
    expect(supply.economy.inventory['item-citrus-cookie']).toBe(3);
    expect(supply.economy.effectQueues.celebration).toEqual([]);
    expect(original).toEqual(withCoins(1_000));

    const service = purchaseInventoryItem(supply.economy, 'service-cozy-grooming', 2);
    expect(service.ok).toBe(true);
    expect(service.economy.coins).toBe(724);
    expect(service.economy.inventory['service-cozy-grooming']).toBe(2);
    expect(service.economy.effectQueues.aura).toEqual([]);
  });

  it('rejects bad quantities, insufficient balances, and stacks above 99 without mutation', () => {
    const original = withCoins(20);
    expect(purchaseInventoryItem(original, 'item-citrus-cookie', 0).code).toBe('invalid-quantity');
    expect(purchaseInventoryItem(original, 'item-citrus-cookie', 11).code).toBe('invalid-quantity');
    expect(purchaseInventoryItem(original, 'item-citrus-cookie', 1.5).code).toBe('invalid-quantity');
    expect(purchaseInventoryItem(original, 'service-grand-festival', 1).code).toBe('insufficient-coins');

    const full = withCoins(10_000);
    full.inventory['item-citrus-cookie'] = 99;
    const overflow = purchaseInventoryItem(full, 'item-citrus-cookie', 1);
    expect(overflow.code).toBe('stack-full');
    expect(overflow.economy).toEqual(full);
    expect(full.coins).toBe(10_000);
  });

  it('consumes exactly one voucher and enqueues all of its effects', () => {
    const economy = withCoins(0);
    economy.inventory['service-sparkle-party'] = 2;
    const used = useInventoryItem(economy, 'service-sparkle-party');
    expect(used.ok).toBe(true);
    expect(used.economy.inventory['service-sparkle-party']).toBe(1);
    expect(used.economy.effectQueues.celebration[0].effectId).toBe('effect-party-ceremony');
    expect(used.economy.effectQueues.theme[0].effectId).toBe('effect-party-theme');
    expect(used.economy.effectQueues.aura[0].effectId).toBe('effect-party-aura');
    expect(used.economy.coins).toBe(0);
    expect(economy.inventory['service-sparkle-party']).toBe(2);
  });

  it('previews restorative effects and rejects full stats or insufficient energy', () => {
    const base = { satiety: 80, mood: 70, energy: 10, cleanliness: 60 };
    expect(applyInventoryStatEffect(base, 100, 'item-citrus-cookie')).toMatchObject({
      ok: true, code: 'applied', stats: { satiety: 95, mood: 70, energy: 10, cleanliness: 60 },
    });
    expect(applyInventoryStatEffect(base, 100, 'item-ribbon-ball')).toMatchObject({
      ok: true, stats: { satiety: 80, mood: 90, energy: 8, cleanliness: 60 },
    });
    expect(applyInventoryStatEffect({ ...base, energy: 1 }, 100, 'item-ribbon-ball').code)
      .toBe('insufficient-stat');
    expect(applyInventoryStatEffect({ ...base, mood: 100 }, 100, 'item-ribbon-ball').code)
      .toBe('stats-full');
    expect(applyInventoryStatEffect(
      { satiety: 100, mood: 100, energy: 100, cleanliness: 100 },
      100,
      'service-grand-festival',
    )).toMatchObject({ ok: true, code: 'already-full', stats: { satiety: 100, mood: 100, energy: 100, cleanliness: 100 } });
    expect(applyInventoryStatEffect(base, 100, 'service-royal-celebration').stats)
      .toEqual({ satiety: 100, mood: 100, energy: 100, cleanliness: 100 });
    expect(applyInventoryStatEffect(base, 100, 'item-mini-keyboard').code).toBe('no-stat-effect');
    expect(base).toEqual({ satiety: 80, mood: 70, energy: 10, cleanliness: 60 });
  });
});

describe('timed effect queues', () => {
  it('runs FIFO within each slot and different slots in parallel using only the supplied runtime', () => {
    const economy = withCoins(0);
    economy.inventory['item-citrus-cookie'] = 1;
    economy.inventory['item-honey-soda'] = 1;
    economy.inventory['item-mini-keyboard'] = 1;
    economy.inventory['item-sunset-theme'] = 1;
    let current = useInventoryItem(economy, 'item-citrus-cookie').economy;
    current = useInventoryItem(current, 'item-honey-soda').economy;
    current = useInventoryItem(current, 'item-mini-keyboard').economy;
    current = useInventoryItem(current, 'item-sunset-theme').economy;

    const advanced = advanceEconomyRuntime(current, 10_000, 100_000);
    expect(advanced.economy.effectQueues.celebration).toHaveLength(1);
    expect(advanced.economy.effectQueues.celebration[0]).toMatchObject({
      effectId: 'effect-honey-soda', remainingRuntimeMs: 6_000,
    });
    expect(advanced.economy.effectQueues.keyboard[0].remainingRuntimeMs).toBe(30 * 60 * 1000 - 10_000);
    expect(advanced.economy.effectQueues.theme[0].remainingRuntimeMs).toBe(60 * 60 * 1000 - 10_000);
    expect(current.effectQueues.celebration).toHaveLength(2);
  });

  it('enforces 32 segments and fourteen runtime days without consuming a rejected voucher', () => {
    const segmentFull = withCoins(0);
    segmentFull.inventory['item-citrus-cookie'] = 1;
    segmentFull.effectQueues.celebration = Array.from({ length: MAX_EFFECT_SEGMENTS_PER_SLOT }, () => ({
      effectId: 'effect-cookie-snack' as const,
      sourceId: 'item-citrus-cookie' as const,
      remainingRuntimeMs: 1,
    }));
    const segmentRejected = useInventoryItem(segmentFull, 'item-citrus-cookie');
    expect(segmentRejected.code).toBe('effect-queue-full');
    expect(segmentRejected.economy.inventory['item-citrus-cookie']).toBe(1);

    let runtimeFull = withCoins(0);
    runtimeFull.inventory['service-grand-festival'] = 5;
    for (let index = 0; index < 4; index += 1) {
      const used = useInventoryItem(runtimeFull, 'service-grand-festival');
      expect(used.ok).toBe(true);
      runtimeFull = used.economy;
    }
    expect(runtimeFull.effectQueues.theme.reduce((sum, effect) => sum + effect.remainingRuntimeMs, 0))
      .toBe(12 * 24 * 60 * 60 * 1000);
    expect(MAX_EFFECT_RUNTIME_PER_SLOT_MS).toBe(14 * 24 * 60 * 60 * 1000);
    const runtimeRejected = useInventoryItem(runtimeFull, 'service-grand-festival');
    expect(runtimeRejected.code).toBe('effect-queue-full');
    expect(runtimeRejected.economy.inventory['service-grand-festival']).toBe(1);
  });

  it('rejects negative or non-finite runtime without changing queues', () => {
    const economy = withCoins(0);
    economy.inventory['item-mini-keyboard'] = 1;
    const used = useInventoryItem(economy, 'item-mini-keyboard').economy;
    const negative = advanceEconomyRuntime(used, -1, 1_000);
    const notFinite = advanceEconomyRuntime(used, Number.NaN, 1_000);
    expect(negative.code).toBe('invalid-runtime');
    expect(notFinite.code).toBe('invalid-runtime');
    expect(negative.economy).toEqual(used);
    expect(notFinite.economy).toEqual(used);
  });
});

describe('expeditions', () => {
  it('charges once, prefers unseen stories, completes once, and grants no currency', () => {
    const economy = withCoins(500);
    economy.travelJournal = ['story-window-sparrow', 'story-bakery-aroma'];
    const started = startExpedition(economy, 'expedition-neighborhood');
    expect(started.ok).toBe(true);
    expect(started.economy.coins).toBe(410);
    expect(started.economy.activeExpedition).toMatchObject({
      expeditionId: 'expedition-neighborhood',
      selectedStoryId: 'story-red-leaf',
      remainingRuntimeMs: 30 * 60 * 1000,
    });
    expect(startExpedition(started.economy, 'expedition-riverside').code).toBe('expedition-active');

    const completed = advanceEconomyRuntime(started.economy, 30 * 60 * 1000, 123_456);
    expect(completed.completedExpedition).toBe(true);
    expect(completed.code).toBe('expedition-completed');
    expect(completed.economy.coins).toBe(410);
    expect(completed.economy.activeExpedition).toBeNull();
    expect(completed.economy.travelJournal).toContain('story-red-leaf');
    expect(completed.economy.pendingExpeditionReward).toEqual({
      expeditionId: 'expedition-neighborhood', storyId: 'story-red-leaf', completedAt: 123_456,
    });
    expect(completed.economy.effectQueues.theme.at(-1)).toMatchObject({
      effectId: 'effect-neighborhood-breeze', sourceId: 'expedition-neighborhood', remainingRuntimeMs: 60 * 60 * 1000,
    });
    expect(completed.economy.effectQueues.celebration.at(-1)).toMatchObject({
      effectId: 'effect-neighborhood-return', sourceId: 'expedition-neighborhood', remainingRuntimeMs: 15_000,
    });

    expect(startExpedition(completed.economy, 'expedition-riverside').code).toBe('reward-pending');
    const acknowledged = acknowledgeExpeditionReward(completed.economy);
    expect(acknowledged.ok).toBe(true);
    expect(acknowledged.economy.pendingExpeditionReward).toBeNull();
  });

  it('rotates through already collected stories using a main-process seed', () => {
    const economy = withCoins(500);
    economy.travelJournal = [
      'story-window-sparrow', 'story-bakery-aroma', 'story-red-leaf', 'story-puddle-moon',
    ];
    expect(startExpedition(economy, 'expedition-neighborhood', 2).economy.activeExpedition?.selectedStoryId)
      .toBe('story-red-leaf');
    expect(startExpedition(economy, 'expedition-neighborhood', 3).economy.activeExpedition?.selectedStoryId)
      .toBe('story-puddle-moon');
  });

  it('advances exploration only by explicit runtime and returns early without refund or reward', () => {
    const started = startExpedition(withCoins(1_000), 'expedition-riverside').economy;
    const progressed = advanceEconomyRuntime(started, 15_000, 50_000);
    expect(progressed.economy.activeExpedition?.remainingRuntimeMs).toBe(2 * 60 * 60 * 1000 - 15_000);
    expect(progressed.economy.pendingExpeditionReward).toBeNull();
    expect(progressed.economy.travelJournal).toEqual([]);

    const returned = returnExpeditionEarly(progressed.economy);
    expect(returned.ok).toBe(true);
    expect(returned.economy.coins).toBe(680);
    expect(returned.economy.activeExpedition).toBeNull();
    expect(returned.economy.pendingExpeditionReward).toBeNull();
    expect(returned.economy.travelJournal).toEqual([]);
    expect(returned.economy.effectQueues.theme).toEqual([]);
  });

  it('reserves reward queue capacity while an exploration is active', () => {
    const economy = withCoins(10_000);
    economy.inventory['item-sunset-theme'] = 32;
    let current = startExpedition(economy, 'expedition-grand-tour').economy;
    for (let index = 0; index < 31; index += 1) {
      const used = useInventoryItem(current, 'item-sunset-theme');
      expect(used.ok).toBe(true);
      current = used.economy;
    }
    const rejected = useInventoryItem(current, 'item-sunset-theme');
    expect(rejected.code).toBe('effect-queue-full');
    expect(rejected.economy.inventory['item-sunset-theme']).toBe(1);
  });
});
