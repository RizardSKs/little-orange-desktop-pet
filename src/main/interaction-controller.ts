import {
  accumulatedCursorTurns,
  canInterruptInteraction,
  directionToward,
  distanceBetween,
  gazeForCursor,
  INTERACTION_DURATION_MS,
  INTERACTION_STAGE_PROFILES,
  isNearbyCursor,
  isTeasingCursor,
  keyboardRhythmIsBusy,
  keyboardRhythmIsQuiet,
  keyboardTempoForBuckets,
  TAP_SETTLE_MS,
  type TimedPoint,
} from '../shared/interaction';
import type {
  GrowthStage,
  KeyboardHookStatus,
  PetDirection,
  PetInteractionKind,
  PetMotionState,
  PetPosition,
  PetRuntimeState,
} from '../shared/types';

export interface InteractionBounds extends PetPosition { width: number; height: number }

export interface InteractionContext {
  bounds: InteractionBounds;
  stage: GrowthStage;
  locked: boolean;
  mouseEnabled: boolean;
  keyboardEnabled: boolean;
  sleeping: boolean;
  careBusy: boolean;
  foregroundFullscreen: boolean;
}

export interface InteractionControllerOptions {
  getContext(): InteractionContext;
  emit(runtime: PetRuntimeState): void;
  openPanel(): void;
  movePet(position: PetPosition): void;
  finishPetMove(): void;
}

const AMBIENT_KINDS = new Set<PetInteractionKind>(['nearby', 'cursor-paw', 'cursor-tug', 'cursor-chase', 'cursor-dizzy']);

function clampStep(value: number): number {
  return Math.max(-24, Math.min(24, value * 0.22));
}

export class InteractionController {
  private runtime: PetRuntimeState = {
    motion: { moving: false, direction: 'right' },
    interaction: { kind: 'idle', sequenceId: 0, startedAt: 0, durationMs: null, direction: 'right' },
    gaze: { x: 0, y: 0 },
    keyboardStatus: 'disabled',
    keyboardTempo: 'calm',
  };

  private actionEndsAt: number | null = null;
  private cursorSamples: TimedPoint[] = [];
  private keyboardBuckets: { count: number; endedAt: number }[] = [];
  private tapCount = 0;
  private lastTapAt = 0;
  private pendingDizzy = false;
  private tugNearSince: number | null = null;
  private tugAnchor: { point: PetPosition; expiresAt: number } | null = null;
  private lastSpontaneousAt = 0;
  private spontaneousStarts: number[] = [];
  private cooldowns = new Map<PetInteractionKind, number>();

  constructor(private readonly options: InteractionControllerOptions) {}

  snapshot(): PetRuntimeState {
    return structuredClone(this.runtime);
  }

  setMotion(motion: PetMotionState): void {
    if (this.runtime.motion.moving === motion.moving && this.runtime.motion.direction === motion.direction) return;
    this.runtime.motion = { ...motion };
    this.emit();
  }

  setKeyboardStatus(status: KeyboardHookStatus, now = Date.now()): void {
    if (this.runtime.keyboardStatus === status) return;
    this.runtime.keyboardStatus = status;
    if (status !== 'ready') {
      this.keyboardBuckets = [];
      this.setKeyboardTempo('calm');
      if (this.runtime.interaction.kind === 'keyboard-typing' || this.runtime.interaction.kind === 'keyboard-rest') this.forceIdle(now);
    }
    this.emit();
  }

  recordKeyboardBucket(count: number, endedAt: number): void {
    if (this.runtime.keyboardStatus !== 'ready' || !Number.isInteger(count) || count <= 0 || count > 250 || !Number.isFinite(endedAt)) return;
    this.keyboardBuckets.push({ count, endedAt });
    this.keyboardBuckets = this.keyboardBuckets.filter((bucket) => bucket.endedAt > endedAt - 8_000).slice(-32);
  }

  recordTap(now = Date.now()): void {
    if (this.options.getContext().locked || this.isDragging()) return;
    if (this.tapCount && now - this.lastTapAt > TAP_SETTLE_MS) this.resolveTaps(now);
    this.tapCount += 1;
    this.lastTapAt = now;
  }

  beginDrag(now = Date.now()): boolean {
    if (this.options.getContext().locked) return false;
    this.tapCount = 0;
    this.pendingDizzy = false;
    this.startInteraction('dragging', now, null, this.runtime.motion.direction, true);
    return true;
  }

  endDrag(now = Date.now()): void {
    if (!this.isDragging()) return;
    this.options.finishPetMove();
    this.forceIdle(now);
    this.startInteraction('landing', now, INTERACTION_DURATION_MS.landing!, this.runtime.motion.direction, true);
  }

  isDragging(): boolean {
    return this.runtime.interaction.kind === 'dragging';
  }

  cancelForLock(now = Date.now()): void {
    this.tapCount = 0;
    this.tugAnchor = null;
    this.tugNearSince = null;
    if (this.isDragging() || this.runtime.interaction.kind === 'cursor-tug') this.options.finishPetMove();
    if (this.runtime.interaction.kind === 'dragging'
      || this.runtime.interaction.kind === 'landing'
      || this.runtime.interaction.kind === 'petting'
      || this.runtime.interaction.kind === 'dodge'
      || this.runtime.interaction.kind === 'cursor-tug') this.forceIdle(now);
  }

  suspendForCare(now = Date.now()): void {
    this.tapCount = 0;
    if (this.runtime.interaction.kind === 'nearby'
      || this.runtime.interaction.kind === 'keyboard-rest'
      || this.runtime.interaction.kind === 'keyboard-typing'
      || this.runtime.interaction.kind === 'cursor-paw'
      || this.runtime.interaction.kind === 'cursor-tug'
      || this.runtime.interaction.kind === 'cursor-chase'
      || this.runtime.interaction.kind === 'cursor-dizzy') {
      if (this.runtime.interaction.kind === 'cursor-tug') this.options.finishPetMove();
      this.pendingDizzy = false;
      this.forceIdle(now);
    }
  }

  tick(cursor: PetPosition | null, now = Date.now()): void {
    const context = this.options.getContext();
    this.expireAction(now);
    if (this.tapCount && now - this.lastTapAt >= TAP_SETTLE_MS) this.resolveTaps(now);
    if (context.sleeping || context.careBusy || context.foregroundFullscreen) {
      this.tapCount = 0;
      this.updateKeyboard(context, now);
      this.cursorSamples = [];
      this.tugAnchor = null;
      this.tugNearSince = null;
      this.pendingDizzy = false;
      this.updateGaze({ x: 0, y: 0 });
      if (AMBIENT_KINDS.has(this.runtime.interaction.kind)) {
        if (this.runtime.interaction.kind === 'cursor-tug') this.options.finishPetMove();
        this.forceIdle(now);
      }
      return;
    }
    this.updateKeyboard(context, now);

    if (!cursor || !context.mouseEnabled) {
      this.cursorSamples = [];
      this.tugAnchor = null;
      this.tugNearSince = null;
      this.updateGaze({ x: 0, y: 0 });
      if (AMBIENT_KINDS.has(this.runtime.interaction.kind)) {
        if (this.runtime.interaction.kind === 'cursor-tug') this.options.finishPetMove();
        this.forceIdle(now);
      }
      return;
    }

    const center = { x: context.bounds.x + context.bounds.width / 2, y: context.bounds.y + context.bounds.height / 2 };
    this.updateGaze(gazeForCursor(cursor, center));
    this.cursorSamples.push({ ...cursor, at: now });
    this.cursorSamples = this.cursorSamples.filter(({ at }) => at >= now - 6_100);

    if (this.runtime.interaction.kind === 'cursor-tug') {
      if (context.locked || context.foregroundFullscreen) {
        this.options.finishPetMove();
        this.forceIdle(now);
      } else {
        const target = { x: cursor.x - context.bounds.width / 2, y: cursor.y - context.bounds.height / 2 };
        this.options.movePet({ x: context.bounds.x + clampStep(target.x - context.bounds.x), y: context.bounds.y + clampStep(target.y - context.bounds.y) });
      }
      return;
    }

    this.updateTugPrime(cursor, center, context, now);
    if (context.sleeping || context.careBusy || context.foregroundFullscreen || this.runtime.motion.moving || this.isDragging()) return;
    if (!this.canStartSpontaneous(now)) return;

    const circleSamples = this.cursorSamples.filter(({ at }) => at >= now - 2_500);
    const turns = accumulatedCursorTurns(circleSamples, center);
    if (turns >= 1.25 && this.cooldownReady('cursor-chase', now)) {
      this.pendingDizzy = turns >= 2;
      this.startSpontaneous('cursor-chase', now, directionToward(center.x, cursor.x), 30_000);
      return;
    }
    if (isTeasingCursor(this.cursorSamples, center) && this.cooldownReady('cursor-paw', now)) {
      this.startSpontaneous('cursor-paw', now, directionToward(center.x, cursor.x), 15_000);
      return;
    }
    if (isNearbyCursor(this.cursorSamples, center) && this.cooldownReady('nearby', now)) {
      this.startSpontaneous('nearby', now, directionToward(center.x, cursor.x), 45_000);
    }
  }

  private updateKeyboard(context: InteractionContext, now: number): void {
    this.keyboardBuckets = this.keyboardBuckets.filter(({ endedAt }) => endedAt > now - 8_000);
    if (!context.keyboardEnabled || this.runtime.keyboardStatus !== 'ready' || context.sleeping || context.careBusy || context.foregroundFullscreen) {
      this.setKeyboardTempo('calm');
      if (this.runtime.interaction.kind === 'keyboard-typing' || this.runtime.interaction.kind === 'keyboard-rest') this.forceIdle(now);
      return;
    }
    this.setKeyboardTempo(keyboardTempoForBuckets(this.keyboardBuckets, now));
    if (this.runtime.interaction.kind === 'keyboard-typing') {
      if (now - this.runtime.interaction.startedAt >= 18_000) {
        this.cooldowns.set('keyboard-typing', now + 12_000);
        this.forceIdle(now);
        this.startInteraction('keyboard-rest', now, INTERACTION_DURATION_MS['keyboard-rest']!, this.runtime.motion.direction, true);
        return;
      }
      if (keyboardRhythmIsQuiet(this.keyboardBuckets, now)) {
        if (now - this.runtime.interaction.startedAt >= 1_500) {
          this.forceIdle(now);
          this.startInteraction('keyboard-rest', now, INTERACTION_DURATION_MS['keyboard-rest']!, this.runtime.motion.direction, true);
        }
      }
      return;
    }
    if (keyboardRhythmIsBusy(this.keyboardBuckets, now) && this.cooldownReady('keyboard-typing', now)) {
      this.startInteraction('keyboard-typing', now, null, this.runtime.motion.direction);
    }
  }

  private updateTugPrime(cursor: PetPosition, center: PetPosition, context: InteractionContext, now: number): void {
    if (context.locked || context.sleeping || context.careBusy
      || context.foregroundFullscreen || this.runtime.motion.moving || this.isDragging()) {
      this.tugNearSince = null;
      this.tugAnchor = null;
      return;
    }
    if (this.tugAnchor) {
      if (now > this.tugAnchor.expiresAt) this.tugAnchor = null;
      else if (distanceBetween(cursor, this.tugAnchor.point) >= 80 && this.cooldownReady('cursor-tug', now) && this.canStartSpontaneous(now)) {
        if (this.startInteraction('cursor-tug', now, INTERACTION_DURATION_MS['cursor-tug']!, directionToward(center.x, cursor.x))) {
          this.lastSpontaneousAt = now;
          this.spontaneousStarts.push(now);
          this.cooldowns.set('cursor-tug', now + 20_000);
          this.tugAnchor = null;
        }
      }
      return;
    }
    if (distanceBetween(cursor, center) <= 100) {
      this.tugNearSince ??= now;
      if (now - this.tugNearSince >= 250) this.tugAnchor = { point: { ...cursor }, expiresAt: now + 1_200 };
    } else this.tugNearSince = null;
  }

  private resolveTaps(now: number): void {
    const count = this.tapCount;
    this.tapCount = 0;
    const context = this.options.getContext();
    if (!count || context.locked) return;
    if (count === 2) {
      this.options.openPanel();
      return;
    }
    const kind = !context.sleeping && count >= 3 ? 'dodge' : 'petting';
    this.startInteraction(kind, now, INTERACTION_DURATION_MS[kind]!, this.runtime.motion.direction);
  }

  private expireAction(now: number): void {
    if (this.actionEndsAt === null || now < this.actionEndsAt) return;
    const ended = this.runtime.interaction.kind;
    if (ended === 'cursor-tug') this.options.finishPetMove();
    this.forceIdle(now);
    if (ended === 'cursor-chase' && this.pendingDizzy) {
      this.pendingDizzy = false;
      this.startInteraction('cursor-dizzy', now, INTERACTION_DURATION_MS['cursor-dizzy']!, this.runtime.motion.direction, true);
    }
  }

  private startSpontaneous(kind: PetInteractionKind, now: number, direction: PetDirection, cooldownMs: number): void {
    if (!this.startInteraction(kind, now, INTERACTION_DURATION_MS[kind] ?? 1_000, direction)) return;
    this.lastSpontaneousAt = now;
    this.spontaneousStarts.push(now);
    this.cooldowns.set(kind, now + cooldownMs);
  }

  private startInteraction(kind: PetInteractionKind, now: number, durationMs: number | null, direction: PetDirection, force = false): boolean {
    if (!force && this.runtime.interaction.kind !== 'idle' && !canInterruptInteraction(this.runtime.interaction.kind, kind)) return false;
    const previousKind = this.runtime.interaction.kind;
    if (previousKind === 'cursor-tug' && kind !== 'cursor-tug') this.options.finishPetMove();
    if (previousKind === 'cursor-chase' && kind !== 'cursor-dizzy') this.pendingDizzy = false;
    const profile = INTERACTION_STAGE_PROFILES[this.options.getContext().stage];
    const adjustedDuration = durationMs === null ? null : Math.round(durationMs * profile.duration);
    this.runtime.interaction = {
      kind,
      sequenceId: this.runtime.interaction.sequenceId + 1,
      startedAt: now,
      durationMs: adjustedDuration,
      direction,
    };
    this.actionEndsAt = adjustedDuration === null ? null : now + adjustedDuration;
    this.emit();
    return true;
  }

  private forceIdle(now: number): void {
    if (this.runtime.interaction.kind === 'idle') return;
    this.runtime.interaction = {
      kind: 'idle',
      sequenceId: this.runtime.interaction.sequenceId + 1,
      startedAt: now,
      durationMs: null,
      direction: this.runtime.interaction.direction,
    };
    this.actionEndsAt = null;
    this.emit();
  }

  private updateGaze(gaze: PetPosition): void {
    if (Math.abs(gaze.x - this.runtime.gaze.x) < 0.04 && Math.abs(gaze.y - this.runtime.gaze.y) < 0.04) return;
    this.runtime.gaze = gaze;
    this.emit();
  }

  private setKeyboardTempo(tempo: PetRuntimeState['keyboardTempo']): void {
    if (this.runtime.keyboardTempo === tempo) return;
    this.runtime.keyboardTempo = tempo;
    this.emit();
  }

  private cooldownReady(kind: PetInteractionKind, now: number): boolean {
    return (this.cooldowns.get(kind) ?? 0) <= now;
  }

  private canStartSpontaneous(now: number): boolean {
    this.spontaneousStarts = this.spontaneousStarts.filter((startedAt) => startedAt > now - 60_000);
    return now - this.lastSpontaneousAt >= 12_000 && this.spontaneousStarts.length < 4;
  }

  private emit(): void {
    this.options.emit(this.snapshot());
  }
}
