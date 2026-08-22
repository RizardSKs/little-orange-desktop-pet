import type { EconomyActionCode, EconomyState, ExpeditionId, InventoryItemId } from './economy-types';
import type { GrowthProgressEvent } from './growth';

export type PetBehavior = 'idle' | 'walking' | 'eating' | 'playing' | 'cleaning' | 'sleeping' | 'sad';
export type PetAction = 'feed' | 'play' | 'clean' | 'sleep';
export type GrowthStage = 'sprout' | 'lively' | 'mature' | 'radiant';
export type AnimationIntensity = 'gentle' | 'normal' | 'lively';
export type PetExpression = 'neutral' | 'happy' | 'curious' | 'surprised' | 'proud' | 'focused' | 'delighted' | 'excited' | 'refreshed' | 'asleep' | 'sad' | 'sleepy' | 'hungry' | 'uncomfortable';
export type PetDirection = 'left' | 'right';
export type KeyboardHookStatus = 'disabled' | 'starting' | 'ready' | 'unavailable';
export type PetInteractionKind = 'idle' | 'nearby' | 'petting' | 'dodge' | 'dragging' | 'landing' | 'keyboard-typing' | 'keyboard-rest' | 'cursor-paw' | 'cursor-tug' | 'cursor-chase' | 'cursor-dizzy';

export type { EconomyState } from './economy-types';
export type { GrowthProgressEvent } from './growth';

export interface PetMotionState {
  moving: boolean;
  direction: PetDirection;
}

export interface PetInteractionVisualState {
  kind: PetInteractionKind;
  sequenceId: number;
  startedAt: number;
  durationMs: number | null;
  direction: PetDirection;
}

export interface PetRuntimeState {
  motion: PetMotionState;
  interaction: PetInteractionVisualState;
  gaze: { x: number; y: number };
  keyboardStatus: KeyboardHookStatus;
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

export interface LegacyEconomyState {
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
  desktopLocked: boolean;
  mouseInteractionsEnabled: boolean;
  keyboardInteractionEnabled: boolean;
  keyboardConsentVersion: number;
}

export type LegacyAppSettings = Omit<AppSettings, 'desktopLocked' | 'mouseInteractionsEnabled' | 'keyboardInteractionEnabled' | 'keyboardConsentVersion'>;

export interface SaveDataV1 {
  schemaVersion: 1;
  pet: PetState;
  growth: GrowthState;
  economy: LegacyEconomyState;
  settings: LegacyAppSettings;
}

export interface SaveData {
  schemaVersion: 2;
  pet: PetState;
  growth: GrowthState;
  economy: EconomyState;
  settings: AppSettings;
}

export interface OfflineSummary {
  elapsedMs: number;
  beforeStats: PetStats;
  afterStats: PetStats;
}

export interface StartupSnapshot {
  state: SaveData;
  runtime: PetRuntimeState;
  offlineSummary: OfflineSummary;
  growthProgress: GrowthProgressEvent | null;
}

export type SettingKey = keyof Pick<AppSettings, 'autoWalk' | 'alwaysOnTop' | 'launchAtLogin' | 'animationIntensity'> | 'petName';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  assetFile: string;
  price: number;
  unlockLevel: number;
  className: string;
}

export interface StateActionResult {
  state: SaveData;
  message: string;
}

export interface EconomyIpcResult extends StateActionResult {
  ok: boolean;
  code: EconomyActionCode;
}

export interface OrangePetApi {
  loadBootstrap(): Promise<StartupSnapshot>;
  loadState(): Promise<SaveData>;
  loadRuntimeState(): Promise<PetRuntimeState>;
  performAction(action: PetAction): Promise<StateActionResult>;
  purchaseInventoryItem(itemId: InventoryItemId, quantity: number): Promise<EconomyIpcResult>;
  useInventoryItem(itemId: InventoryItemId): Promise<EconomyIpcResult>;
  startExpedition(expeditionId: ExpeditionId): Promise<EconomyIpcResult>;
  returnExpeditionEarly(): Promise<EconomyIpcResult>;
  acknowledgeExpeditionReward(): Promise<EconomyIpcResult>;
  setSetting(key: SettingKey, value: boolean | string): Promise<SaveData>;
  setDesktopLocked(locked: boolean): Promise<SaveData>;
  setMouseInteractions(enabled: boolean): Promise<SaveData>;
  setKeyboardInteraction(enabled: boolean, consentVersion?: number): Promise<SaveData>;
  recordPetTap(): Promise<void>;
  beginPetDrag(): Promise<boolean>;
  endPetDrag(): Promise<void>;
  togglePanel(): Promise<void>;
  showContextMenu(): Promise<void>;
  setPetPosition(position: PetPosition): Promise<void>;
  buyItem(itemId: string): Promise<{ ok: boolean; message: string; state: SaveData }>;
  equipItem(itemId: string | null): Promise<SaveData>;
  quitApp(): Promise<void>;
  onStateChanged(callback: (state: SaveData) => void): () => void;
  onMotionChanged(callback: (motion: PetMotionState) => void): () => void;
  onRuntimeChanged(callback: (runtime: PetRuntimeState) => void): () => void;
  onGrowthProgress(callback: (progress: GrowthProgressEvent) => void): () => void;
}

export interface OrangePetUnlockApi {
  unlock(): Promise<void>;
}

declare global {
  interface Window {
    orangePet: OrangePetApi;
    orangePetUnlock?: OrangePetUnlockApi;
  }
}
