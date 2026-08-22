import { useEffect, useRef, useState } from 'react';
import type { GrowthProgressEvent, PetRuntimeState, SaveData } from '../shared/types';
import { PanelView } from './panel-view';
import { PetView } from './pet-view';

const DEFAULT_RUNTIME: PetRuntimeState = {
  motion: { moving: false, direction: 'right' },
  interaction: { kind: 'idle', sequenceId: 0, startedAt: 0, durationMs: null, direction: 'right' },
  gaze: { x: 0, y: 0 },
  keyboardStatus: 'disabled',
};

export interface GrowthCelebrationState {
  title: string;
  detail: string;
  kind: 'level' | 'stage' | 'star' | 'max';
}

function usePetState() {
  const [state, setState] = useState<SaveData | null>(null);
  const [runtime, setRuntime] = useState<PetRuntimeState>(DEFAULT_RUNTIME);
  const [notice, setNotice] = useState('');
  const [growthCelebration, setGrowthCelebration] = useState<GrowthCelebrationState | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const growthTimer = useRef<number | null>(null);

  useEffect(() => {
    const showGrowthProgress = (progress: GrowthProgressEvent) => {
      const major = [...progress.milestones].reverse().find((item) => item.kind !== 'level') ?? progress.milestones.at(-1);
      if (!major) return;
      const kind = major.kind;
      setGrowthCelebration({
        kind,
        title: progress.toLevel - progress.fromLevel > 1 ? `连升 ${progress.toLevel - progress.fromLevel} 级！` : `升级到 Lv.${progress.toLevel}`,
        detail: kind === 'stage' ? `进化为${major.title}` : major.title,
      });
      if (growthTimer.current) window.clearTimeout(growthTimer.current);
      growthTimer.current = window.setTimeout(() => setGrowthCelebration(null), kind === 'stage' ? 4_800 : kind === 'star' || kind === 'max' ? 3_200 : 2_200);
    };
    void window.orangePet.loadBootstrap().then((loaded) => {
      setState(loaded.state);
      setRuntime(loaded.runtime);
      if (loaded.growthProgress) showGrowthProgress(loaded.growthProgress);
    });
    const unsubscribeState = window.orangePet.onStateChanged((next) => {
      setState(next);
    });
    const unsubscribeRuntime = window.orangePet.onRuntimeChanged(setRuntime);
    const unsubscribeGrowth = window.orangePet.onGrowthProgress(showGrowthProgress);
    return () => {
      unsubscribeState();
      unsubscribeRuntime();
      unsubscribeGrowth();
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      if (growthTimer.current) window.clearTimeout(growthTimer.current);
    };
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2_600);
  };

  return { state, setState, runtime, notice, flash, growthCelebration };
}

export function App() {
  const view = new URLSearchParams(location.search).get('view') ?? 'panel';
  document.body.dataset.view = view;
  const pet = usePetState();
  if (!pet.state) return <div className={`loading ${view}`}>{view === 'panel' ? '正在叫醒小橙子…' : ''}</div>;
  return view === 'pet'
    ? <PetView state={pet.state} runtime={pet.runtime} growthCelebration={pet.growthCelebration} />
    : <PanelView {...pet} state={pet.state} />;
}
