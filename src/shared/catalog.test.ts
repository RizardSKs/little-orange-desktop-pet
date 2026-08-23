import { describe, expect, it } from 'vitest';
import {
  EXPEDITIONS,
  INVENTORY_ITEMS,
  SERVICE_VOUCHERS,
  SHOP_ITEMS,
  SUPPLY_ITEMS,
  TRAVEL_STORIES,
} from './catalog';
import {
  EFFECT_IDS,
  EXPEDITION_IDS,
  INVENTORY_ITEM_IDS,
  SERVICE_VOUCHER_IDS,
  STORY_IDS,
  SUPPLY_ITEM_IDS,
} from './economy-types';

describe('economy catalogs', () => {
  it('keeps outfit IDs stable and defines every inventory item once', () => {
    expect(SHOP_ITEMS.map((item) => item.id)).toEqual([
      'leaf-clip', 'bow', 'glasses', 'top-hat', 'headphones', 'scarf', 'crown', 'halo',
    ]);
    expect(SUPPLY_ITEMS.map((item) => item.id)).toEqual(SUPPLY_ITEM_IDS);
    expect(SERVICE_VOUCHERS.map((item) => item.id)).toEqual(SERVICE_VOUCHER_IDS);
    expect(INVENTORY_ITEMS.map((item) => item.id)).toEqual(INVENTORY_ITEM_IDS);
    expect(new Set(INVENTORY_ITEMS.map((item) => item.id)).size).toBe(13);
    expect(INVENTORY_ITEMS.every((item) => item.id.length <= 40 && item.maxStack === 99)).toBe(true);
  });

  it('requires a dedicated local use visual for every supply and service', () => {
    expect(INVENTORY_ITEMS.map((item) => [
      item.id,
      item.useVisual.durationMs,
      item.useVisual.expression,
      item.useVisual.assetFile,
    ])).toEqual([
      ['item-citrus-cookie', 8_000, 'delighted', 'inventory/citrus-cookie.png'],
      ['item-honey-soda', 8_000, 'refreshed', 'inventory/honey-soda.png'],
      ['item-ribbon-ball', 12_000, 'excited', 'inventory/ribbon-ball.png'],
      ['item-bubble-bath', 12_000, 'refreshed', 'inventory/bubble-bath.png'],
      ['item-mini-keyboard', 10_000, 'focused', 'mini-keyboard.png'],
      ['item-mouse-feather', 10_000, 'excited', 'inventory/mouse-feather.png'],
      ['item-sunset-theme', 8_000, 'happy', 'inventory/sunset-orb.png'],
      ['item-stage-sparkle', 8_000, 'surprised', 'inventory/stage-sparkles.png'],
      ['service-cozy-grooming', 20_000, 'refreshed', 'inventory/grooming-kit.png'],
      ['service-desktop-picnic', 45_000, 'delighted', 'inventory/picnic-set.png'],
      ['service-sparkle-party', 60_000, 'excited', 'inventory/party-popper.png'],
      ['service-royal-celebration', 90_000, 'proud', 'inventory/royal-fanfare.png'],
      ['service-grand-festival', 120_000, 'proud', 'inventory/grand-fireworks.png'],
    ]);
    expect(new Set(INVENTORY_ITEMS.map((item) => item.useVisual.assetFile)).size).toBe(13);
  });

  it('locks the intended price curve and ordinary spending ratios', () => {
    expect(SUPPLY_ITEMS.map((item) => item.price)).toEqual([12, 18, 24, 28, 36, 36, 54, 72]);
    expect(SERVICE_VOUCHERS.map((item) => item.price)).toEqual([120, 260, 680, 1_880, 5_200]);

    const standardIds = new Set([
      'item-citrus-cookie', 'item-ribbon-ball', 'item-bubble-bath',
      'item-mini-keyboard', 'item-mouse-feather', 'item-sunset-theme',
    ]);
    const standardSpend = SUPPLY_ITEMS
      .filter((item) => standardIds.has(item.id))
      .reduce((sum, item) => sum + item.price, 0);
    const activeSpend = SUPPLY_ITEMS.reduce((sum, item) => sum + item.price, 0);
    expect(standardSpend).toBe(190);
    expect(standardSpend / 230).toBeGreaterThanOrEqual(0.7);
    expect(standardSpend / 230).toBeLessThanOrEqual(0.9);
    expect(activeSpend).toBe(280);
    expect(activeSpend / 353).toBeGreaterThanOrEqual(0.7);
    expect(activeSpend / 353).toBeLessThanOrEqual(0.9);
  });

  it('declares the exact restorative effects without giving stats to cosmetic items', () => {
    expect(SUPPLY_ITEMS.map((item) => [item.id, item.stats ?? null])).toEqual([
      ['item-citrus-cookie', { add: { satiety: 15 } }],
      ['item-honey-soda', { add: { energy: 12 } }],
      ['item-ribbon-ball', { add: { mood: 20, energy: -2 } }],
      ['item-bubble-bath', { add: { cleanliness: 30 } }],
      ['item-mini-keyboard', null],
      ['item-mouse-feather', null],
      ['item-sunset-theme', null],
      ['item-stage-sparkle', null],
    ]);
    expect(SERVICE_VOUCHERS.map((item) => [item.id, item.stats])).toEqual([
      ['service-cozy-grooming', { add: { mood: 10 }, fillToCap: ['cleanliness'] }],
      ['service-desktop-picnic', { fillToCap: ['satiety', 'mood'] }],
      ['service-sparkle-party', { fillToCap: ['mood'] }],
      ['service-royal-celebration', { fillToCap: ['satiety', 'mood', 'energy', 'cleanliness'] }],
      ['service-grand-festival', { fillToCap: ['satiety', 'mood', 'energy', 'cleanliness'] }],
    ]);
  });

  it('defines four expeditions and sixteen non-overlapping stories', () => {
    expect(EXPEDITIONS.map((expedition) => expedition.id)).toEqual(EXPEDITION_IDS);
    expect(EXPEDITIONS.map((expedition) => expedition.price)).toEqual([90, 320, 980, 3_200]);
    expect(EXPEDITIONS.map((expedition) => expedition.durationRuntimeMs)).toEqual([
      30 * 60 * 1000,
      2 * 60 * 60 * 1000,
      6 * 60 * 60 * 1000,
      12 * 60 * 60 * 1000,
    ]);
    expect(TRAVEL_STORIES.map((story) => story.id)).toEqual(STORY_IDS);
    const assignedStories = EXPEDITIONS.flatMap((expedition) => expedition.storyIds);
    expect(assignedStories).toHaveLength(16);
    expect(new Set(assignedStories).size).toBe(16);
    expect(new Set(assignedStories)).toEqual(new Set(STORY_IDS));
  });

  it('uses only registered positive effects and valid stable IDs', () => {
    const registeredEffects = new Set(EFFECT_IDS);
    const grants = [
      ...INVENTORY_ITEMS.flatMap((item) => item.effects),
      ...EXPEDITIONS.flatMap((expedition) => [expedition.completionEffect, expedition.rewardEffect]),
    ];
    expect(grants.every((grant) => registeredEffects.has(grant.effectId) && grant.durationMs > 0)).toBe(true);
    const allIds = [
      ...INVENTORY_ITEM_IDS,
      ...EXPEDITION_IDS,
      ...STORY_IDS,
      ...EFFECT_IDS,
    ];
    expect(allIds.every((id) => id.length <= 40)).toBe(true);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('locks timed item, service, and return-effect durations', () => {
    expect(SUPPLY_ITEMS.map((item) => item.effects.map((effect) => effect.durationMs))).toEqual([
      [], [], [], [],
      [30 * 60 * 1000], [30 * 60 * 1000], [60 * 60 * 1000], [30 * 60 * 1000],
    ]);
    expect(SERVICE_VOUCHERS.map((item) => item.effects.map((effect) => effect.durationMs))).toEqual([
      [2 * 60 * 60 * 1000],
      [4 * 60 * 60 * 1000],
      [8 * 60 * 60 * 1000, 8 * 60 * 60 * 1000],
      [24 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
      [72 * 60 * 60 * 1000, 72 * 60 * 60 * 1000],
    ]);
    expect(EXPEDITIONS.map((expedition) => expedition.completionAnimationMs)).toEqual([
      15_000, 20_000, 30_000, 45_000,
    ]);
    expect(EXPEDITIONS.map((expedition) => expedition.completionEffect.durationMs)).toEqual([
      15_000, 20_000, 30_000, 45_000,
    ]);
    expect(EXPEDITIONS.map((expedition) => expedition.rewardEffect.durationMs)).toEqual([
      60 * 60 * 1000,
      4 * 60 * 60 * 1000,
      10 * 60 * 60 * 1000,
      24 * 60 * 60 * 1000,
    ]);
  });
});
