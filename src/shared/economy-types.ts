export const SUPPLY_ITEM_IDS = [
  'item-citrus-cookie',
  'item-honey-soda',
  'item-ribbon-ball',
  'item-bubble-bath',
  'item-mini-keyboard',
  'item-mouse-feather',
  'item-sunset-theme',
  'item-stage-sparkle',
] as const;

export type SupplyItemId = typeof SUPPLY_ITEM_IDS[number];

export const SERVICE_VOUCHER_IDS = [
  'service-cozy-grooming',
  'service-desktop-picnic',
  'service-sparkle-party',
  'service-royal-celebration',
  'service-grand-festival',
] as const;

export type ServiceVoucherId = typeof SERVICE_VOUCHER_IDS[number];
export type InventoryItemId = SupplyItemId | ServiceVoucherId;
export const INVENTORY_ITEM_IDS: readonly InventoryItemId[] = [...SUPPLY_ITEM_IDS, ...SERVICE_VOUCHER_IDS];

export const EXPEDITION_IDS = [
  'expedition-neighborhood',
  'expedition-riverside',
  'expedition-starlight',
  'expedition-grand-tour',
] as const;

export type ExpeditionId = typeof EXPEDITION_IDS[number];

export const STORY_IDS = [
  'story-window-sparrow',
  'story-bakery-aroma',
  'story-red-leaf',
  'story-puddle-moon',
  'story-reed-whistle',
  'story-bridge-breeze',
  'story-firefly-map',
  'story-river-stone',
  'story-rooftop-stars',
  'story-night-train',
  'story-lantern-cloud',
  'story-star-letter',
  'story-orange-orchard',
  'story-snowy-station',
  'story-seaside-sunrise',
  'story-homeward-postcard',
] as const;

export type StoryId = typeof STORY_IDS[number];

export const EFFECT_SLOTS = ['celebration', 'keyboard', 'mouse', 'theme', 'aura'] as const;
export type EffectSlot = typeof EFFECT_SLOTS[number];

export const EFFECT_IDS = [
  'effect-cookie-snack',
  'effect-honey-soda',
  'effect-ribbon-play',
  'effect-bubble-bath',
  'effect-mini-keyboard',
  'effect-mouse-feather',
  'effect-sunset-theme',
  'effect-stage-sparkle',
  'effect-grooming-ceremony',
  'effect-grooming-glow',
  'effect-picnic-ceremony',
  'effect-picnic-theme',
  'effect-party-ceremony',
  'effect-party-theme',
  'effect-party-aura',
  'effect-royal-ceremony',
  'effect-royal-theme',
  'effect-royal-aura',
  'effect-grand-ceremony',
  'effect-grand-theme',
  'effect-grand-aura',
  'effect-neighborhood-return',
  'effect-neighborhood-breeze',
  'effect-riverside-return',
  'effect-riverside-shimmer',
  'effect-starlight-return',
  'effect-starlight-window',
  'effect-grand-tour-return',
  'effect-grand-tour-sunset',
] as const;

export type EffectId = typeof EFFECT_IDS[number];

export type TravelOutfitId = 'travel-satchel' | 'travel-raincoat' | 'travel-star-cape' | 'travel-grand-backpack';

export interface TimedEffect {
  effectId: EffectId;
  sourceId: InventoryItemId | ExpeditionId;
  remainingRuntimeMs: number;
}

export type EffectQueues = Record<EffectSlot, TimedEffect[]>;

export interface ActiveExpedition {
  expeditionId: ExpeditionId;
  remainingRuntimeMs: number;
  selectedStoryId: StoryId;
}

export interface PendingExpeditionReward {
  expeditionId: ExpeditionId;
  storyId: StoryId;
  completedAt: number;
}

export interface EconomyState {
  coins: number;
  ownedItems: string[];
  equippedItem: string | null;
  inventory: Partial<Record<InventoryItemId, number>>;
  effectQueues: EffectQueues;
  activeExpedition: ActiveExpedition | null;
  travelJournal: StoryId[];
  pendingExpeditionReward: PendingExpeditionReward | null;
}

export type EconomyActionCode =
  | 'purchased'
  | 'used'
  | 'expedition-started'
  | 'expedition-returned'
  | 'expedition-completed'
  | 'reward-acknowledged'
  | 'advanced'
  | 'invalid-item'
  | 'invalid-quantity'
  | 'insufficient-coins'
  | 'stack-full'
  | 'item-unavailable'
  | 'stats-full'
  | 'insufficient-stat'
  | 'invalid-stats'
  | 'effect-queue-full'
  | 'invalid-expedition'
  | 'expedition-active'
  | 'reward-pending'
  | 'no-active-expedition'
  | 'no-pending-reward'
  | 'invalid-runtime';

export interface EconomyActionResult {
  ok: boolean;
  code: EconomyActionCode;
  message: string;
  economy: EconomyState;
}

export interface RuntimeAdvanceResult extends EconomyActionResult {
  completedExpedition: boolean;
}

export function createEmptyEffectQueues(): EffectQueues {
  return { celebration: [], keyboard: [], mouse: [], theme: [], aura: [] };
}

export function createDefaultEconomyState(): EconomyState {
  return {
    coins: 30,
    ownedItems: [],
    equippedItem: null,
    inventory: {},
    effectQueues: createEmptyEffectQueues(),
    activeExpedition: null,
    travelJournal: [],
    pendingExpeditionReward: null,
  };
}

const inventoryItemIdSet: ReadonlySet<string> = new Set(INVENTORY_ITEM_IDS);
const expeditionIdSet: ReadonlySet<string> = new Set(EXPEDITION_IDS);
const storyIdSet: ReadonlySet<string> = new Set(STORY_IDS);
const effectIdSet: ReadonlySet<string> = new Set(EFFECT_IDS);
const effectSlotSet: ReadonlySet<string> = new Set(EFFECT_SLOTS);

export const isInventoryItemId = (value: unknown): value is InventoryItemId =>
  typeof value === 'string' && inventoryItemIdSet.has(value);

export const isExpeditionId = (value: unknown): value is ExpeditionId =>
  typeof value === 'string' && expeditionIdSet.has(value);

export const isEffectSourceId = (value: unknown): value is InventoryItemId | ExpeditionId =>
  isInventoryItemId(value) || isExpeditionId(value);

export const isStoryId = (value: unknown): value is StoryId =>
  typeof value === 'string' && storyIdSet.has(value);

export const isEffectId = (value: unknown): value is EffectId =>
  typeof value === 'string' && effectIdSet.has(value);

export const isEffectSlot = (value: unknown): value is EffectSlot =>
  typeof value === 'string' && effectSlotSet.has(value);
