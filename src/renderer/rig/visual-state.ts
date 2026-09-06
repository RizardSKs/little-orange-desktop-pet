import type { GrowthStage } from '../../shared/types';
import type { TravelOutfitId } from '../../shared/economy-types';
import type { OutfitId } from '../outfit-layout';

export interface VisualTarget { stage: GrowthStage; outfit: OutfitId | null; travel: TravelOutfitId | null }
export interface VisualBundle extends VisualTarget { generation: number; fallback: boolean; degraded: boolean }
export interface LoadResult { character: boolean; attachment: boolean }

/** Loading has no effect on the displayed geometry until a safe atomic commit. */
export class VisualState {
  generation = 0;
  committed: VisualBundle;
  pending: { target: VisualTarget; generation: number; result?: LoadResult } | null = null;
  private failedStage: GrowthStage | null = null;
  constructor(stage: GrowthStage) {
    this.committed = { stage, outfit: null, travel: null, generation: 0, fallback: true, degraded: false };
  }
  request(target: VisualTarget): number {
    const generation = ++this.generation;
    this.pending = { target: { ...target, outfit: target.travel ? null : target.outfit }, generation };
    return generation;
  }
  resolve(generation: number, result: LoadResult): boolean {
    if (this.pending?.generation !== generation) return false;
    this.pending.result = result;
    return true;
  }
  commit(safe: boolean): boolean {
    const pending = this.pending;
    if (!safe || !pending?.result) return false;
    if (pending.target.stage !== this.committed.stage) this.failedStage = null;
    if (!pending.result.character) this.failedStage = pending.target.stage;
    this.committed = { ...pending.target, generation: pending.generation,
      outfit: pending.result.attachment ? pending.target.outfit : null,
      travel: pending.result.attachment ? pending.target.travel : null,
      fallback: this.failedStage === pending.target.stage,
      degraded: !pending.result.character || !pending.result.attachment };
    this.pending = null;
    return true;
  }
  failCharacter(): void {
    this.failedStage = this.committed.stage;
    this.committed = { ...this.committed, fallback: true, degraded: true };
  }
  failAttachment(): void {
    this.committed = { ...this.committed, outfit: null, travel: null, degraded: true };
  }
}
