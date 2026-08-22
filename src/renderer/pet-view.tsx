import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { findExpedition, SHOP_ITEMS } from '../shared/catalog';
import { activeEffectForSlot } from '../shared/economy';
import { EFFECT_SLOTS, type EffectId } from '../shared/economy-types';
import { resolvePetExpression } from '../shared/expression';
import { radiantStarsForLevel } from '../shared/growth';
import { DRAG_THRESHOLD_DIP } from '../shared/interaction';
import type { PetExpression, PetRuntimeState, SaveData } from '../shared/types';
import type { GrowthCelebrationState } from './App';

const EXPRESSION_TEXT: Record<PetExpression, string> = {
  neutral: '今天也要元气满满！', happy: '心情真不错～', curious: '那边是什么？', surprised: '哇！', proud: '我超棒的！',
  focused: '一步、两步～', delighted: '好好吃！', excited: '一起玩吧！', refreshed: '亮晶晶～', asleep: '呼…呼…',
  sad: '想要抱抱…', sleepy: '有一点困啦…', hungry: '肚子咕咕叫…', uncomfortable: '想洗香香…',
};

const TRAVEL_ICONS = {
  'travel-satchel': '👜',
  'travel-raincoat': '🧥',
  'travel-star-cape': '🌌',
  'travel-grand-backpack': '🎒',
} as const;

const CELEBRATION_PROPS: Partial<Record<EffectId, string>> = {
  'effect-cookie-snack': '🍪',
  'effect-honey-soda': '🥤',
  'effect-ribbon-play': '🧶',
  'effect-bubble-bath': '🫧',
  'effect-grooming-ceremony': '🧴',
  'effect-picnic-ceremony': '🧺',
  'effect-party-ceremony': '🎉',
  'effect-royal-ceremony': '👑',
  'effect-grand-ceremony': '🎆',
  'effect-neighborhood-return': '📮',
  'effect-riverside-return': '💧',
  'effect-starlight-return': '🌠',
  'effect-grand-tour-return': '🗺️',
};

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  windowX: number;
  windowY: number;
  thresholdReached: boolean;
  active: boolean;
  released: boolean;
  latestX: number;
  latestY: number;
}

export function PetView({ state, runtime, growthCelebration }: {
  state: SaveData;
  runtime: PetRuntimeState;
  growthCelebration: GrowthCelebrationState | null;
}) {
  const drag = useRef<DragState | null>(null);
  const dragFrame = useRef<number | null>(null);
  const [idleRoll, setIdleRoll] = useState(() => Math.random());
  const [layerFailed, setLayerFailed] = useState(false);
  const expression = resolvePetExpression(state, idleRoll);
  const assetRoot = location.protocol === 'file:' ? '../assets/pet' : '/assets/pet';
  const stageRoot = `${assetRoot}/${state.growth.stage}`;
  const fallbackSprite = `${assetRoot}/${state.growth.stage}.png`;
  const expressionSprite = `${stageRoot}/expressions/${expression}.png`;
  const equipped = SHOP_ITEMS.find((item) => item.id === state.economy.equippedItem);
  const expedition = state.economy.activeExpedition ? findExpedition(state.economy.activeExpedition.expeditionId) : null;
  const stars = radiantStarsForLevel(state.growth.level);
  const celebrationEffect = activeEffectForSlot(state.economy, 'celebration')?.effectId ?? null;
  const celebrationProp = celebrationEffect ? CELEBRATION_PROPS[celebrationEffect] : null;
  const direction = runtime.interaction.kind === 'idle' ? runtime.motion.direction : runtime.interaction.direction;
  const activeEffects = EFFECT_SLOTS
    .map((slot) => activeEffectForSlot(state.economy, slot)?.effectId)
    .filter((effect): effect is string => Boolean(effect))
    .join(' ');
  const style = {
    '--gaze-x': runtime.gaze.x,
    '--gaze-y': runtime.gaze.y,
    '--stage-stars': stars,
  } as CSSProperties;

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => { setIdleRoll(Math.random()); schedule(); }, 5_000 + Math.round(Math.random() * 4_000));
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
      const currentDrag = drag.current;
      drag.current = null;
      if (currentDrag?.active) void window.orangePet.endPetDrag().catch(() => undefined);
    };
  }, []);

  useEffect(() => setLayerFailed(false), [state.growth.stage]);

  const moveWindow = (current: DragState, screenX: number, screenY: number) => {
    const dx = screenX - current.startX;
    const dy = screenY - current.startY;
    return window.orangePet.setPetPosition({ x: current.windowX + dx, y: current.windowY + dy });
  };

  const cancelDragFrame = () => {
    if (dragFrame.current === null) return;
    window.cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
  };

  const scheduleWindowMove = (current: DragState) => {
    if (dragFrame.current !== null) return;
    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = null;
      if (drag.current === current && current.active && !current.released) {
        void moveWindow(current, current.latestX, current.latestY);
      }
    });
  };

  const finishActiveDrag = async (current: DragState, moveToReleasePoint: boolean) => {
    cancelDragFrame();
    if (moveToReleasePoint) {
      try { await moveWindow(current, current.latestX, current.latestY); } catch { /* always clear main-process drag state */ }
    }
    try { await window.orangePet.endPetDrag(); } catch { /* main process may already have cleared the drag */ }
  };

  const pointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || state.settings.desktopLocked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      windowX: event.screenX - event.clientX,
      windowY: event.screenY - event.clientY,
      thresholdReached: false,
      active: false,
      released: false,
      latestX: event.screenX,
      latestY: event.screenY,
    };
  };

  const pointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latestX = event.screenX;
    current.latestY = event.screenY;
    const distance = Math.hypot(event.screenX - current.startX, event.screenY - current.startY);
    if (!current.thresholdReached && distance >= DRAG_THRESHOLD_DIP) {
      current.thresholdReached = true;
      void window.orangePet.beginPetDrag().then((accepted) => {
        if (!accepted) {
          if (drag.current === current) drag.current = null;
          return;
        }
        if (drag.current !== current) {
          void window.orangePet.endPetDrag().catch(() => undefined);
          return;
        }
        current.active = true;
        if (current.released) {
          drag.current = null;
          void finishActiveDrag(current, true);
        } else scheduleWindowMove(current);
      }).catch(() => { if (drag.current === current) drag.current = null; });
    } else if (current.active) scheduleWindowMove(current);
  };

  const pointerCancel = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    cancelDragFrame();
    if (current.active) void finishActiveDrag(current, false);
  };

  const pointerUp = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.released = true;
    if (current.active) {
      drag.current = null;
      void finishActiveDrag(current, true);
    } else if (!current.thresholdReached) {
      drag.current = null;
      void window.orangePet.recordPetTap();
    }
  };

  return (
    <main className={`pet-screen intensity-${state.settings.animationIntensity} theme-${activeEffectForSlot(state.economy, 'theme')?.effectId ?? 'none'}`} style={style}>
      {growthCelebration && <div className={`growth-burst ${growthCelebration.kind}`}><strong>{growthCelebration.title}</strong><span>{growthCelebration.detail}</span></div>}
      <div className={`speech expression-${expression}`}>{EXPRESSION_TEXT[expression]}</div>
      <div
        className={`pet-character stage-${state.growth.stage} expression-${expression} interaction-${runtime.interaction.kind} behavior-${state.pet.behavior} ${runtime.motion.moving ? 'is-moving' : ''} ${expedition ? 'is-travelling' : ''} ${activeEffects}`}
        onContextMenu={(event) => { event.preventDefault(); void window.orangePet.showContextMenu(); }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
      >
        <div className="stage-glow" />
        <div className="stage-particles">✦</div>
        <div className={`pet-facing direction-${direction}`}>
          <div className="pet-rig">
            {layerFailed ? <img className="pet-texture fallback-texture" src={fallbackSprite} draggable={false} alt={state.pet.name} /> : <>
              <img className="pet-layer limb leg leg-left" src={`${stageRoot}/leg-left.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb leg leg-right" src={`${stageRoot}/leg-right.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb arm arm-left" src={`${stageRoot}/arm-left.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer limb arm arm-right" src={`${stageRoot}/arm-right.png`} draggable={false} alt="" onError={() => setLayerFailed(true)} />
              <img className="pet-layer pet-body" src={`${stageRoot}/body.png`} draggable={false} alt={state.pet.name} onError={() => setLayerFailed(true)} />
              <img className="pet-layer pet-expression" src={expressionSprite} draggable={false} alt="" onError={() => setLayerFailed(true)} />
            </>}
            <div className="orange-fallback" />
          </div>
        </div>
        {expedition ? <span className={`travel-outfit ${expedition.travelOutfit}`}>{TRAVEL_ICONS[expedition.travelOutfit]}</span> : equipped && <span className={equipped.className}>{equipped.icon}</span>}
        {runtime.interaction.kind === 'keyboard-typing' && <span className="interaction-prop mini-keyboard">⌨️</span>}
        {runtime.interaction.kind === 'cursor-paw' && <span className="interaction-prop mouse-feather">🪶</span>}
        {celebrationProp && <span className={`celebration-prop ${celebrationEffect}`}>{celebrationProp}</span>}
        {state.pet.behavior === 'sleeping' && <span className="zzz">Z<small>z</small></span>}
        {(expression === 'refreshed' || stars > 0) && <span className="sparkles">{'✦'.repeat(Math.min(3, Math.max(1, stars)))}</span>}
      </div>
    </main>
  );
}
