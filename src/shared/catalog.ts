import type {
  EffectId,
  EffectSlot,
  ExpeditionId,
  InventoryItemId,
  ServiceVoucherId,
  StoryId,
  SupplyItemId,
  TravelOutfitId,
} from './economy-types';
import type { ShopItem } from './types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const INVENTORY_STACK_LIMIT = 99;

export type PetStatKey = 'satiety' | 'mood' | 'energy' | 'cleanliness';

export interface InventoryStatEffect {
  add?: Partial<Record<PetStatKey, number>>;
  fillToCap?: readonly PetStatKey[];
}

export interface EffectGrant {
  slot: EffectSlot;
  effectId: EffectId;
  durationMs: number;
}

export interface InventoryCatalogItem {
  id: InventoryItemId;
  kind: 'supply' | 'service';
  name: string;
  icon: string;
  description: string;
  price: number;
  maxStack: number;
  stats?: InventoryStatEffect;
  effects: readonly EffectGrant[];
}

export interface TravelStory {
  id: StoryId;
  title: string;
  text: string;
}

export interface ExpeditionCatalogItem {
  id: ExpeditionId;
  name: string;
  icon: string;
  description: string;
  price: number;
  durationRuntimeMs: number;
  travelOutfit: TravelOutfitId;
  storyIds: readonly StoryId[];
  completionAnimationMs: number;
  completionEffect: EffectGrant;
  rewardEffect: EffectGrant;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'leaf-clip', name: '叶子发卡', icon: '🌿', assetFile: 'leaf-clip.png', price: 20, unlockLevel: 1, className: 'wearable leaf-clip' },
  { id: 'bow', name: '橙色蝴蝶结', icon: '🎀', assetFile: 'bow.png', price: 35, unlockLevel: 2, className: 'wearable bow' },
  { id: 'glasses', name: '圆框眼镜', icon: '👓', assetFile: 'glasses.png', price: 55, unlockLevel: 4, className: 'wearable glasses' },
  { id: 'top-hat', name: '小礼帽', icon: '🎩', assetFile: 'top-hat.png', price: 80, unlockLevel: 6, className: 'wearable top-hat' },
  { id: 'headphones', name: '音乐耳机', icon: '🎧', assetFile: 'headphones.png', price: 110, unlockLevel: 8, className: 'wearable headphones' },
  { id: 'scarf', name: '温暖围巾', icon: '🧣', assetFile: 'scarf.png', price: 150, unlockLevel: 10, className: 'wearable scarf' },
  { id: 'crown', name: '金色皇冠', icon: '👑', assetFile: 'crown.png', price: 240, unlockLevel: 15, className: 'wearable crown' },
  { id: 'halo', name: '星星光环', icon: '✨', assetFile: 'halo.png', price: 360, unlockLevel: 20, className: 'wearable halo' },
];

export const findShopItem = (id: string) => SHOP_ITEMS.find((item) => item.id === id);

export const SUPPLY_ITEMS: readonly InventoryCatalogItem[] = [
  {
    id: 'item-citrus-cookie' satisfies SupplyItemId,
    kind: 'supply',
    name: '橘香饼干',
    icon: '🍪',
    description: '让小橙子开心吃点心，播放 8 秒进食动作。',
    price: 12,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { add: { satiety: 15 } },
    effects: [{ slot: 'celebration', effectId: 'effect-cookie-snack', durationMs: 8_000 }],
  },
  {
    id: 'item-honey-soda' satisfies SupplyItemId,
    kind: 'supply',
    name: '蜂蜜汽水',
    icon: '🥤',
    description: '陪小橙子喝一杯，播放 8 秒畅饮动作。',
    price: 18,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { add: { energy: 12 } },
    effects: [{ slot: 'celebration', effectId: 'effect-honey-soda', durationMs: 8_000 }],
  },
  {
    id: 'item-ribbon-ball' satisfies SupplyItemId,
    kind: 'supply',
    name: '缎带毛球',
    icon: '🧶',
    description: '来一场轻松的缎带游戏，播放 12 秒玩耍动作。',
    price: 24,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { add: { mood: 20, energy: -2 } },
    effects: [{ slot: 'celebration', effectId: 'effect-ribbon-play', durationMs: 12_000 }],
  },
  {
    id: 'item-bubble-bath' satisfies SupplyItemId,
    kind: 'supply',
    name: '泡泡浴券',
    icon: '🫧',
    description: '享受一场泡泡浴，播放 12 秒护理动作。',
    price: 28,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { add: { cleanliness: 30 } },
    effects: [{ slot: 'celebration', effectId: 'effect-bubble-bath', durationMs: 12_000 }],
  },
  {
    id: 'item-mini-keyboard' satisfies SupplyItemId,
    kind: 'supply',
    name: '迷你键盘券',
    icon: '⌨️',
    description: '键盘陪打动作换成特别款，按应用运行时间持续 30 分钟。',
    price: 36,
    maxStack: INVENTORY_STACK_LIMIT,
    effects: [{ slot: 'keyboard', effectId: 'effect-mini-keyboard', durationMs: 30 * MINUTE_MS }],
  },
  {
    id: 'item-mouse-feather' satisfies SupplyItemId,
    kind: 'supply',
    name: '鼠标逗趣羽',
    icon: '🪶',
    description: '强化鼠标逗趣动作，按应用运行时间持续 30 分钟。',
    price: 36,
    maxStack: INVENTORY_STACK_LIMIT,
    effects: [{ slot: 'mouse', effectId: 'effect-mouse-feather', durationMs: 30 * MINUTE_MS }],
  },
  {
    id: 'item-sunset-theme' satisfies SupplyItemId,
    kind: 'supply',
    name: '落日桌面主题券',
    icon: '🌇',
    description: '启用温暖的落日主题，按应用运行时间持续 60 分钟。',
    price: 54,
    maxStack: INVENTORY_STACK_LIMIT,
    effects: [{ slot: 'theme', effectId: 'effect-sunset-theme', durationMs: HOUR_MS }],
  },
  {
    id: 'item-stage-sparkle' satisfies SupplyItemId,
    kind: 'supply',
    name: '阶段星辉券',
    icon: '🌟',
    description: '启用随成长阶段变化的星辉，按应用运行时间持续 30 分钟。',
    price: 72,
    maxStack: INVENTORY_STACK_LIMIT,
    effects: [{ slot: 'aura', effectId: 'effect-stage-sparkle', durationMs: 30 * MINUTE_MS }],
  },
];

export const SERVICE_VOUCHERS: readonly InventoryCatalogItem[] = [
  {
    id: 'service-cozy-grooming' satisfies ServiceVoucherId,
    kind: 'service',
    name: '舒适护理券',
    icon: '🧴',
    description: '20 秒护理仪式与 2 小时柔光效果。',
    price: 120,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { add: { mood: 10 }, fillToCap: ['cleanliness'] },
    effects: [
      { slot: 'celebration', effectId: 'effect-grooming-ceremony', durationMs: 20_000 },
      { slot: 'aura', effectId: 'effect-grooming-glow', durationMs: 2 * HOUR_MS },
    ],
  },
  {
    id: 'service-desktop-picnic' satisfies ServiceVoucherId,
    kind: 'service',
    name: '桌边野餐券',
    icon: '🧺',
    description: '45 秒桌边野餐与 4 小时野餐主题。',
    price: 260,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { fillToCap: ['satiety', 'mood'] },
    effects: [
      { slot: 'celebration', effectId: 'effect-picnic-ceremony', durationMs: 45_000 },
      { slot: 'theme', effectId: 'effect-picnic-theme', durationMs: 4 * HOUR_MS },
    ],
  },
  {
    id: 'service-sparkle-party' satisfies ServiceVoucherId,
    kind: 'service',
    name: '闪耀派对券',
    icon: '🎉',
    description: '60 秒派对与 8 小时主题、光环。',
    price: 680,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { fillToCap: ['mood'] },
    effects: [
      { slot: 'celebration', effectId: 'effect-party-ceremony', durationMs: 60_000 },
      { slot: 'theme', effectId: 'effect-party-theme', durationMs: 8 * HOUR_MS },
      { slot: 'aura', effectId: 'effect-party-aura', durationMs: 8 * HOUR_MS },
    ],
  },
  {
    id: 'service-royal-celebration' satisfies ServiceVoucherId,
    kind: 'service',
    name: '皇家庆典券',
    icon: '👑',
    description: '90 秒庆典与 24 小时皇家主题、光环。',
    price: 1_880,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { fillToCap: ['satiety', 'mood', 'energy', 'cleanliness'] },
    effects: [
      { slot: 'celebration', effectId: 'effect-royal-ceremony', durationMs: 90_000 },
      { slot: 'theme', effectId: 'effect-royal-theme', durationMs: 24 * HOUR_MS },
      { slot: 'aura', effectId: 'effect-royal-aura', durationMs: 24 * HOUR_MS },
    ],
  },
  {
    id: 'service-grand-festival' satisfies ServiceVoucherId,
    kind: 'service',
    name: '橙光盛典券',
    icon: '🎆',
    description: '120 秒盛典与 72 小时橙光主题、光环。',
    price: 5_200,
    maxStack: INVENTORY_STACK_LIMIT,
    stats: { fillToCap: ['satiety', 'mood', 'energy', 'cleanliness'] },
    effects: [
      { slot: 'celebration', effectId: 'effect-grand-ceremony', durationMs: 120_000 },
      { slot: 'theme', effectId: 'effect-grand-theme', durationMs: 72 * HOUR_MS },
      { slot: 'aura', effectId: 'effect-grand-aura', durationMs: 72 * HOUR_MS },
    ],
  },
];

export const INVENTORY_ITEMS: readonly InventoryCatalogItem[] = [...SUPPLY_ITEMS, ...SERVICE_VOUCHERS];

export const TRAVEL_STORIES: readonly TravelStory[] = [
  { id: 'story-window-sparrow', title: '窗边的麻雀', text: '小橙子和窗边的麻雀互相歪着头看了好一会儿。' },
  { id: 'story-bakery-aroma', title: '面包店的香气', text: '街角飘来刚出炉的香气，小橙子认真记住了回家的路。' },
  { id: 'story-red-leaf', title: '一片红叶', text: '小橙子捡到一片像小手掌的红叶，想回来讲给你听。' },
  { id: 'story-puddle-moon', title: '水洼里的月亮', text: '小橙子绕着水洼走了一圈，发现月亮一直跟在脚边。' },
  { id: 'story-reed-whistle', title: '芦苇口哨', text: '河风穿过芦苇，吹出一段轻轻的口哨声。' },
  { id: 'story-bridge-breeze', title: '桥上的风', text: '站上小桥时风把围巾吹得高高的，小橙子笑个不停。' },
  { id: 'story-firefly-map', title: '萤火地图', text: '几只萤火虫排成一条亮亮的小路，送小橙子走过河岸。' },
  { id: 'story-river-stone', title: '会发亮的石头', text: '小橙子找到一颗被河水磨圆的石头，夕阳下闪着橙光。' },
  { id: 'story-rooftop-stars', title: '屋顶星图', text: '小橙子在屋顶把最亮的星星连成了一只橙子的形状。' },
  { id: 'story-night-train', title: '夜行小火车', text: '远处的小火车亮着暖灯，像一串慢慢移动的星星。' },
  { id: 'story-lantern-cloud', title: '灯笼云', text: '云朵被月光照成一盏灯笼，小橙子一路追着它看。' },
  { id: 'story-star-letter', title: '写给你的星光信', text: '小橙子把旅途里最亮的一点星光，写进了给你的信。' },
  { id: 'story-orange-orchard', title: '橙香果园', text: '整片果园在风里摇晃，小橙子说这里闻起来很像家。' },
  { id: 'story-snowy-station', title: '落雪车站', text: '小小车站铺满新雪，小橙子留下了一串圆圆的脚印。' },
  { id: 'story-seaside-sunrise', title: '海边日出', text: '太阳从海面升起时，小橙子把第一束橙光装进背包。' },
  { id: 'story-homeward-postcard', title: '回家的明信片', text: '旅途最后一站，小橙子只写下一句话：回家见。' },
];

export const EXPEDITIONS: readonly ExpeditionCatalogItem[] = [
  {
    id: 'expedition-neighborhood', name: '街角散步', icon: '🧭', description: '背上小挎包，到附近走一圈。',
    price: 90, durationRuntimeMs: 30 * MINUTE_MS, travelOutfit: 'travel-satchel',
    storyIds: ['story-window-sparrow', 'story-bakery-aroma', 'story-red-leaf', 'story-puddle-moon'],
    completionAnimationMs: 15_000,
    completionEffect: { slot: 'celebration', effectId: 'effect-neighborhood-return', durationMs: 15_000 },
    rewardEffect: { slot: 'theme', effectId: 'effect-neighborhood-breeze', durationMs: HOUR_MS },
  },
  {
    id: 'expedition-riverside', name: '河畔远足', icon: '🏞️', description: '穿上雨衣，去河畔听风。',
    price: 320, durationRuntimeMs: 2 * HOUR_MS, travelOutfit: 'travel-raincoat',
    storyIds: ['story-reed-whistle', 'story-bridge-breeze', 'story-firefly-map', 'story-river-stone'],
    completionAnimationMs: 20_000,
    completionEffect: { slot: 'celebration', effectId: 'effect-riverside-return', durationMs: 20_000 },
    rewardEffect: { slot: 'theme', effectId: 'effect-riverside-shimmer', durationMs: 4 * HOUR_MS },
  },
  {
    id: 'expedition-starlight', name: '星夜旅行', icon: '🌌', description: '披上星光斗篷，进行一次夜间旅行。',
    price: 980, durationRuntimeMs: 6 * HOUR_MS, travelOutfit: 'travel-star-cape',
    storyIds: ['story-rooftop-stars', 'story-night-train', 'story-lantern-cloud', 'story-star-letter'],
    completionAnimationMs: 30_000,
    completionEffect: { slot: 'celebration', effectId: 'effect-starlight-return', durationMs: 30_000 },
    rewardEffect: { slot: 'theme', effectId: 'effect-starlight-window', durationMs: 10 * HOUR_MS },
  },
  {
    id: 'expedition-grand-tour', name: '橙光远行', icon: '🎒', description: '带上大背包，完成一段长途旅行。',
    price: 3_200, durationRuntimeMs: 12 * HOUR_MS, travelOutfit: 'travel-grand-backpack',
    storyIds: ['story-orange-orchard', 'story-snowy-station', 'story-seaside-sunrise', 'story-homeward-postcard'],
    completionAnimationMs: 45_000,
    completionEffect: { slot: 'celebration', effectId: 'effect-grand-tour-return', durationMs: 45_000 },
    rewardEffect: { slot: 'theme', effectId: 'effect-grand-tour-sunset', durationMs: 24 * HOUR_MS },
  },
];

export const findInventoryItem = (id: string) => INVENTORY_ITEMS.find((item) => item.id === id);
export const findExpedition = (id: string) => EXPEDITIONS.find((item) => item.id === id);
export const findTravelStory = (id: string) => TRAVEL_STORIES.find((story) => story.id === id);
