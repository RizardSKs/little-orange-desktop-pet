import { MAX_INTERRUPTED_PROP_EXIT_MS, type InterruptPolicy } from './actions';
import type { Drawable } from './frame';

export interface PropExit { at: number; duration: number; drawables: Drawable[] }
export function interruptProps(drawables: readonly Drawable[], policy: InterruptPolicy, at: number, sequenceId: number, reduced: boolean): PropExit {
  const eligible=policy==='fade-held-prop' || policy==='keep-in-scene';
  return { at, duration: reduced ? 0 : MAX_INTERRUPTED_PROP_EXIT_MS,
    drawables:eligible ? drawables.filter(part=>part.id==='action-prop'||part.id==='picnic-food').map(part=>({...part,id:`exit-${sequenceId}-${part.id}`})) : [] };
}
export function exitAt(exit: PropExit | null, now: number): Drawable[] {
  if(!exit || now>=exit.at+exit.duration || exit.duration===0)return [];
  const opacity=1-Math.max(0,now-exit.at)/exit.duration;
  return exit.drawables.map(part=>({...part,opacity:(part.opacity??1)*opacity}));
}
