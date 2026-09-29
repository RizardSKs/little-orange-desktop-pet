import { performAction } from '../shared/game';
import { CARE_COMMAND_CACHE_SIZE } from '../shared/care';
import type { CareActionResult, CareRequest, CareVisual, PetAction, SaveData } from '../shared/types';

interface Dependencies {
  state(): SaveData;
  busy(action: PetAction): boolean;
  save(next: SaveData): void;
  commit(next: SaveData): void;
  present(action: CareVisual, now: number): void;
  publish(): void;
}

/** Synchronous command transaction; renderer callbacks never enter this boundary. */
export class CareController {
  private results = new Map<string, { signature: string; result: CareActionResult }>();
  constructor(private readonly dependencies: Dependencies) {}

  execute(source: string, action: PetAction, request: CareRequest, now = Date.now()): CareActionResult {
    if (!request || typeof request.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,96}$/.test(request.id)
      || (request.sleepTarget !== undefined && (action !== 'sleep' || !['asleep', 'awake'].includes(request.sleepTarget)))) {
      throw new Error('无效互动请求');
    }
    const key = `${source}/${request.id}`;
    const signature = `${action}/${request.sleepTarget ?? ''}`;
    const prior = this.results.get(key);
    if (prior) {
      if (prior.signature !== signature) throw new Error('互动请求标识不能重复使用');
      return { ...prior.result, state: this.dependencies.state() };
    }
    const remember = (result: CareActionResult) => {
      this.results.set(key, { signature, result });
      if (this.results.size > CARE_COMMAND_CACHE_SIZE) this.results.delete(this.results.keys().next().value!);
      return result;
    };
    const current = this.dependencies.state();
    if (this.dependencies.busy(action)) return remember({ state: current, ok: false, code: 'busy', message: '小橙子正在忙，稍等一下再来吧。' });
    const result = performAction(current, action, now, request.sleepTarget);
    try { this.dependencies.save(result.state); }
    catch { return remember({ state: current, ok: false, code: 'save-failed', message: '这次互动未能保存，请稍后重新操作。' }); }
    this.dependencies.commit(result.state);
    remember(result);
    // A committed command is never retried because presentation or a window failed.
    try {
      if (result.ok && result.code === 'performed') {
        this.dependencies.present(action === 'sleep' ? (result.state.pet.behavior === 'sleeping' ? 'sleep-in' : 'wake') : action, now);
      }
    } catch { result.message += '（照顾已保存，动作显示暂时不可用。）'; }
    finally {
      try { this.dependencies.publish(); } catch { /* A subsequent snapshot repairs a lost window broadcast. */ }
    }
    return result;
  }
}
