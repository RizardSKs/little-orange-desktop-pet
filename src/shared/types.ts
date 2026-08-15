export type PetBehavior = 'idle' | 'walking' | 'eating' | 'playing' | 'cleaning' | 'sleeping' | 'sad';
export type PetAction = 'feed' | 'play' | 'clean' | 'sleep';
export type GrowthStage = 'sprout' | 'lively' | 'mature' | 'radiant';
export type AnimationIntensity = 'gentle' | 'normal' | 'lively';
export type PetExpression = 'neutral' | 'happy' | 'curious' | 'surprised' | 'proud' | 'focused' | 'delighted' | 'excited' | 'refreshed' | 'asleep' | 'sad' | 'sleepy' | 'hungry' | 'uncomfortable';
export type PetDirection = 'left' | 'right';

export interface PetMotionState {
  moving: boolean;
  direction: PetDirection;
}

export interface PetStats {
  satiety: number;
  mood: number;
  energy: number;
  cleanliness: number;
}

export interface PetState {
  name: string;
  behavior: PetBehavior;
  stats: PetStats;
  lastUpdatedAt: number;
}

export interface GrowthState {
  level: number;
  experience: number;
  stage: GrowthStage;
  totalOnlineMs: number;
  rewardRemainderMs: number;
}

export interface EconomyState {
  coins: number;
  ownedItems: string[];
  equippedItem: string | null;
}

export interface PetPosition { x: number; y: number }

export interface AppSettings {
  autoWalk: boolean;
  alwaysOnTop: boolean;
  launchAtLogin: boolean;
  animationIntensity: AnimationIntensity;
  petPosition: PetPosition | null;
}

export interface SaveData {
  schemaVersion: 1;
  pet: PetState;
  growth: GrowthState;
  economy: EconomyState;
  settings: AppSettings;
}

export interface OfflineSummary {
  elapsedMs: number;
  coins: number;
  experience: number;
}

export type SettingKey = keyof Pick<AppSettings, 'autoWalk' | 'alwaysOnTop' | 'launchAtLogin' | 'animationIntensity'> | 'petName';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  unlockLevel: number;
  className: string;
}

export interface OrangePetApi {
  loadState(): Promise<SaveData>;
  performAction(action: PetAction): Promise<SaveData>;
  setSetting(key: SettingKey, value: boolean | string): Promise<SaveData>;
  togglePanel(): Promise<void>;
  showContextMenu(): Promise<void>;
  setPetPosition(position: PetPosition): Promise<void>;
  buyItem(itemId: string): Promise<{ ok: boolean; message: string; state: SaveData }>;
  equipItem(itemId: string | null): Promise<SaveData>;
  quitApp(): Promise<void>;
  onStateChanged(callback: (state: SaveData) => void): () => void;
  onMotionChanged(callback: (motion: PetMotionState) => void): () => void;
}

declare global {
  interface Window { orangePet: OrangePetApi }
}
