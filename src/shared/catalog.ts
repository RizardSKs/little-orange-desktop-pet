import type { ShopItem } from './types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'leaf-clip', name: '叶子发卡', icon: '🌿', price: 20, unlockLevel: 1, className: 'wearable leaf-clip' },
  { id: 'bow', name: '橙色蝴蝶结', icon: '🎀', price: 35, unlockLevel: 2, className: 'wearable bow' },
  { id: 'glasses', name: '圆框眼镜', icon: '👓', price: 55, unlockLevel: 4, className: 'wearable glasses' },
  { id: 'top-hat', name: '小礼帽', icon: '🎩', price: 80, unlockLevel: 6, className: 'wearable top-hat' },
  { id: 'headphones', name: '音乐耳机', icon: '🎧', price: 110, unlockLevel: 8, className: 'wearable headphones' },
  { id: 'scarf', name: '温暖围巾', icon: '🧣', price: 150, unlockLevel: 10, className: 'wearable scarf' },
  { id: 'crown', name: '金色皇冠', icon: '👑', price: 240, unlockLevel: 15, className: 'wearable crown' },
  { id: 'halo', name: '星星光环', icon: '✨', price: 360, unlockLevel: 20, className: 'wearable halo' },
];

export const findShopItem = (id: string) => SHOP_ITEMS.find((item) => item.id === id);
