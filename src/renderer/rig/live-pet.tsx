import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GrowthStage, PetDirection, PetExpression, PetRuntimeState, AnimationIntensity } from '../../shared/types';
import type { TravelOutfitId } from '../../shared/economy-types';
import type { OutfitId } from '../outfit-layout';
import type { DragVisual } from '../drag-visual';
import { actionAt, MAX_REDUCED_TRANSITION_MS, type ActionInput } from './actions';
import { petFrame } from './pet-frame';
import { RigRenderer } from './rig-renderer';
import { VisualState } from './visual-state';
import { outfitSpec } from './attachments';
import { travelSpecs } from './travel';
import { exitAt, interruptProps, type PropExit } from './interruptions';

interface Props {
  stage: GrowthStage; outfit: OutfitId | null; travel: TravelOutfitId | null;
  runtime: PetRuntimeState; expression: PetExpression; direction: PetDirection;
  intensity: AnimationIntensity; dragVisual: RefObject<DragVisual | undefined>;
}
const expressions:PetExpression[]=['neutral','happy','curious','surprised','proud','focused','delighted','excited','refreshed','asleep','sad','sleepy','hungry','uncomfortable'];
const decode=(src:string)=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>image.decode().then(resolve,reject);image.onerror=()=>reject(new Error(`Local asset unavailable: ${src}`));image.src=src;});
export function LivePet(props:Props) {
  const root=location.protocol==='file:'?'../assets':'/assets';
  const latest=useRef(props);latest.current=props;
  const state=useRef(new VisualState(props.stage));
  const [view,setView]=useState<ReturnType<typeof petFrame>|null>(null);
  const [shownStage,setShownStage]=useState(props.stage);
  const reduced=useRef(false);
  const failedProps=useRef(new Set<string>());
  const propAssets=useRef(new Map<string,'loading'|'ready'|'failed'>());
  useEffect(()=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{reduced.current=preference.matches;}; update();preference.addEventListener('change',update);
    return ()=>preference.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    const target={stage:props.stage,outfit:props.outfit,travel:props.travel};
    const generation=state.current.request(target);
    const characterFiles=['torso','leaves','arm-left','arm-right','leg-left','leg-right','segment','hand','mouth-delighted','mouth-refreshed',...expressions.map(id=>`expressions/${id}`)];
    const attachmentFiles=props.travel?travelSpecs(props.stage,props.travel).flatMap(spec=>spec.layers.map(layer=>`${root}/outfits/travel/${layer.file}`))
      :props.outfit?outfitSpec(props.stage,props.outfit).layers.map(layer=>`${root}/outfits/${layer.file}`):[];
    let active=true;
    void Promise.all([
      Promise.all(characterFiles.map(file=>decode(`${root}/pet/${props.stage}/${file}.png`))).then(()=>true,()=>false),
      Promise.all(attachmentFiles.map(decode)).then(()=>true,()=>false),
    ]).then(([character,attachment])=>{if(active)state.current.resolve(generation,{character,attachment});});
    return ()=>{active=false;};
  },[props.stage,props.outfit,props.travel,root]);
  useEffect(()=>{
    let handle=0;
    let last:ReturnType<typeof petFrame>|null=null;
    let lastSequence:number|null=null;
    let exit:PropExit|null=null;
    let weight=reduced.current?0:1;
    let fromWeight=weight, targetWeight=weight, weightAt=0;
    const tick=()=>{
      const p=latest.current;const now=Date.now();
      const target=reduced.current?0:1;
      if(target!==targetWeight){fromWeight=weight;targetWeight=target;weightAt=now;}
      weight=fromWeight+(targetWeight-fromWeight)*Math.min(1,(now-weightAt)/MAX_REDUCED_TRANSITION_MS);
      const sequence=p.runtime.interaction.sequenceId;
      const bundle=state.current.committed;
      const input:ActionInput={stage:bundle.stage,direction:p.direction,intensity:p.intensity,reduced:reduced.current,expression:p.expression,kind:p.runtime.interaction.kind,
        itemId:p.runtime.interaction.kind==='inventory-use'?p.runtime.interaction.inventoryItemId:null,sequenceId:sequence,
        timeMs:Math.max(0,now-p.runtime.interaction.startedAt),motionWeight:weight,moving:p.runtime.motion.moving,drag:p.dragVisual.current,keyboardTempo:p.runtime.keyboardTempo};
      if(last && lastSequence!==sequence) {
        exit=interruptProps(last.drawables,last.policy,now,lastSequence??0,reduced.current);
        failedProps.current.clear();
      }
      const safe=actionAt(input,root).safe && exitAt(exit,now).length===0;
      state.current.commit(safe);
      const committed=state.current.committed;
      let frame=petFrame({...input,stage:committed.stage},committed.outfit,p.expression,root,committed.fallback,committed.travel);
      const propsReady=frame.drawables.filter(part=>part.src?.startsWith(`${root}/props/`)).map(part=>{
        const src=part.src!;
        if(!propAssets.current.has(src)){
          propAssets.current.set(src,'loading');
          void decode(src).then(()=>propAssets.current.set(src,'ready'),()=>propAssets.current.set(src,'failed'));
        }
        return propAssets.current.get(src)==='ready';
      }).every(Boolean);
      if(!propsReady) frame=petFrame({...input,stage:committed.stage,kind:'idle',itemId:null},committed.outfit,p.expression,root,committed.fallback,committed.travel);
      frame.drawables=frame.drawables.filter(part=>!failedProps.current.has(part.id));
      if(!committed.fallback)frame.drawables.push(...exitAt(exit,now));
      last=frame;lastSequence=sequence;
      setShownStage(committed.stage);setView(frame);
      handle=requestAnimationFrame(tick);
    };
    handle=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(handle);
  },[root]);
  const onAssetError=(id:string)=>{
    if(id.startsWith('outfit-')||id.startsWith('travel-'))state.current.failAttachment();
    else if(id==='action-prop'||id==='picnic-food'||id.startsWith('exit-'))failedProps.current.add(id);
    else if(id!=='fallback')state.current.failCharacter();
  };
  return <div aria-hidden="true" data-visual-generation={state.current.committed.generation} data-visual-degraded={state.current.committed.degraded} style={{position:'absolute',left:-28,top:-49,width:220,height:220,pointerEvents:'none'}}>
    {view && <RigRenderer stage={shownStage} drawables={view.drawables} onAssetError={onAssetError}/>}
  </div>;
}
