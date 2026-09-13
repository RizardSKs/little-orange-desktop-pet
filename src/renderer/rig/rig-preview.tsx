import { useEffect, useRef, useState } from 'react';
import type { GrowthStage, PetDirection } from '../../shared/types';
import { STAGES } from './geometry';
import { gateFrame, visualSeed } from './frame';
import { RigRenderer } from './rig-renderer';
import { characterFrame } from './character';
import { REST_POSE } from './geometry';
import { attachmentDrawables, outfitSpec, OUTFIT_IDS } from './attachments';
import type { OutfitId } from '../outfit-layout';
import { ACTIONS } from './actions';
import { petFrame } from './pet-frame';
import type { InventoryItemId } from '../../shared/economy-types';
import { findInventoryItem } from '../../shared/catalog';
import { TRAVEL_IDS } from './travel';
import type { TravelOutfitId } from '../../shared/economy-types';
import { LivePet } from './live-pet';
import type { DragVisual } from '../drag-visual';

export function RigPreview() {
  const query = new URLSearchParams(location.search);
  const initialStage = query.get('stage');
  const [time, setTime] = useState(Number(query.get('time') ?? 650));
  const [stage, setStage] = useState<GrowthStage>(STAGES.includes(initialStage as GrowthStage) ? initialStage as GrowthStage : 'lively');
  const [direction, setDirection] = useState<PetDirection>(query.get('direction') === 'left' ? 'left' : 'right');
  const [outfit, setOutfit] = useState(query.get('outfit') ?? '');
  const [action, setAction] = useState(query.get('action') ?? '');
  const [travel,setTravel]=useState(query.get('travel') ?? '');
  const [playing,setPlaying]=useState(query.get('play') === 'true');
  const [reduced,setReduced]=useState(query.get('reduced') === 'true');
  const [sequence,setSequence]=useState(1);
  const dragVisual=useRef<DragVisual|undefined>(undefined);
  const epoch=useRef(Date.now());
  const character = characterFrame(stage, direction, 'neutral', { body: REST_POSE, leftArm: Number(query.get('angle') ?? 0), rightArm: -Number(query.get('angle') ?? 0), leftLeg: 0, rightLeg: 0 }, '/assets/pet');
  if (OUTFIT_IDS.includes(outfit as OutfitId)) character.push(...attachmentDrawables(outfitSpec(stage, outfit as OutfitId), outfit, REST_POSE, direction, '/assets/outfits'));
  const item = findInventoryItem(action);
  const duration = item?.useVisual.durationMs ?? 3000;
  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - time;
    let handle = 0;
    const tick = () => {
      const next = Math.min(duration, performance.now() - start);
      setTime(Math.round(next));
      if (next < duration) handle = requestAnimationFrame(tick); else setPlaying(false);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
    // Time is a seek position captured when playback starts, not a per-frame dependency.
  }, [playing, duration, action, sequence]);
  const actionFrame = item || travel ? petFrame({stage,direction,intensity:'normal',reduced,kind:item?'inventory-use':'idle',itemId:item?.id ?? null,sequenceId:1,timeMs:time,durationMs:duration,moving:!item},OUTFIT_IDS.includes(outfit as OutfitId) ? outfit as OutfitId : null,item?.useVisual.expression ?? 'neutral','/assets',false,TRAVEL_IDS.includes(travel as TravelOutfitId)?travel as TravelOutfitId:null) : null;
  return <main style={{ background: '#f4f0e9', height: '100vh', overflow: 'auto', padding: 24 }}>
    <h1>角色与附件预览</h1><p>固定时间直接求帧；共用正式绘制组件，不连接存档。</p>
    <label>装扮 <select value={outfit} onChange={(event) => setOutfit(event.target.value)}><option value="">无</option>{OUTFIT_IDS.map((id) => <option key={id}>{id}</option>)}</select></label>
    <label> 动作 <select value={action} onChange={(event) => {setAction(event.target.value);setTime(0);setSequence(value=>value+1);epoch.current=Date.now();}}><option value="">无</option>{Object.keys(ACTIONS).map(id=><option key={id} value={id}>{findInventoryItem(id)?.name ?? id}</option>)}</select></label>
    <label> 旅行装 <select value={travel} onChange={event=>setTravel(event.target.value)}><option value="">无</option>{TRAVEL_IDS.map(id=><option key={id}>{id}</option>)}</select></label>
    <label>成长阶段 <select value={stage} onChange={(event) => setStage(event.target.value as GrowthStage)}>{STAGES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label> 朝向 <select value={direction} onChange={(event) => setDirection(event.target.value as PetDirection)}><option>right</option><option>left</option></select></label>
    <p><label>动作时间 {time} / {duration} ms <input type="range" min="0" max={duration} value={time} onChange={(event) => {setPlaying(false);setTime(Number(event.target.value));}} /></label></p>
    {query.get('fixture')!=='live' ? <p><button onClick={() => {if(time>=duration)setTime(0);setPlaying(!playing);}}>{playing?'暂停':'播放'}</button> <button onClick={() => {setTime(0);setPlaying(true);setSequence(value=>value+1);epoch.current=Date.now();}}>重新播放</button> <label><input type="checkbox" checked={reduced} onChange={event=>setReduced(event.target.checked)}/>减少动态</label></p> : <p>真实组件自动播放；减少动态效果跟随系统偏好。</p>}
    <div data-preview-viewport style={{ position: 'relative', width: 220, height: 220, background: '#fff', outline: '1px solid #bda98b' }}>
      {query.get('fixture')==='live'?<div style={{position:'absolute',left:28,top:49}}><LivePet stage={stage} outfit={OUTFIT_IDS.includes(outfit as OutfitId)?outfit as OutfitId:null} travel={TRAVEL_IDS.includes(travel as TravelOutfitId)?travel as TravelOutfitId:null}
        expression={item?.useVisual.expression??'neutral'} direction={direction} intensity="normal" dragVisual={dragVisual}
        runtime={{motion:{moving:!item,direction},interaction:{kind:item?'inventory-use':'idle',inventoryItemId:item?.id??null,sequenceId:sequence,startedAt:epoch.current-time,durationMs:item?.useVisual.durationMs??null,direction},gaze:{x:0,y:0},keyboardStatus:'disabled',keyboardTempo:'calm'}}/></div>
        :<RigRenderer stage={stage} drawables={actionFrame?.drawables ?? (query.get('fixture') === 'character' || outfit ? character : gateFrame(time, direction, visualSeed('gate:1')))} />}
    </div>
  </main>;
}
