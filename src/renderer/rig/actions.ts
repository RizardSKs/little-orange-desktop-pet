import type { InventoryItemId } from '../../shared/economy-types';
import type { AnimationIntensity, GrowthStage, PetDirection, PetInteractionKind, PetExpression } from '../../shared/types';
import { findInventoryItem } from '../../shared/catalog';
import type { DragVisual } from '../drag-visual';
import { BODY_LANDMARKS } from './attachments';
import { SHOULDERS, type CharacterPose } from './character';
import { anchorMatrix, bodyMatrix, chain, DISPLAY, rotate, scale, transform, translate, REST_POSE, type Matrix, type Point } from './geometry';
import { particleAt, visualSeed, type Drawable } from './frame';
import { sampleActionAt } from './sample-actions';

export type ContactPhase = 'approach' | 'acquire' | 'attached' | 'release' | 'retract';
export type InterruptPolicy = 'fade-held-prop' | 'keep-in-scene' | 'resume-free-motion' | 'hide-immediately';
export const MAX_INTERRUPTED_PROP_EXIT_MS = 200;
export const MAX_REDUCED_TRANSITION_MS = 120;
export const MAX_GRIP_ERROR_ASSET_PX = 1;
export const CONTACT_BOUNDARIES = [.2, .3, .72, .84] as const;
type ActionMode = 'two-hand' | 'free' | 'wash' | 'scene' | 'one-hand' | 'effect' | 'picnic';
interface ActionSpec { cycleMs: number; mode: ActionMode; policy: InterruptPolicy; rotation: number; lift: number }
export const ACTIONS: Record<InventoryItemId, ActionSpec> = {
  'item-citrus-cookie': { cycleMs: 2000, mode: 'two-hand', policy: 'fade-held-prop', rotation: 0, lift: 44 },
  'item-honey-soda': { cycleMs: 2400, mode: 'two-hand', policy: 'fade-held-prop', rotation: -14, lift: 46 },
  'item-ribbon-ball': { cycleMs: 2600, mode: 'free', policy: 'resume-free-motion', rotation: 35, lift: 30 },
  'item-bubble-bath': { cycleMs: 2800, mode: 'wash', policy: 'hide-immediately', rotation: 0, lift: 15 },
  'item-mini-keyboard': { cycleMs: 2200, mode: 'scene', policy: 'keep-in-scene', rotation: 0, lift: 0 },
  'item-mouse-feather': { cycleMs: 2500, mode: 'free', policy: 'resume-free-motion', rotation: -20, lift: 35 },
  'item-sunset-theme': { cycleMs: 3200, mode: 'effect', policy: 'hide-immediately', rotation: 0, lift: 30 },
  'item-stage-sparkle': { cycleMs: 2800, mode: 'effect', policy: 'hide-immediately', rotation: 180, lift: 35 },
  'service-cozy-grooming': { cycleMs: 2600, mode: 'one-hand', policy: 'fade-held-prop', rotation: 15, lift: 30 },
  'service-desktop-picnic': { cycleMs: 3600, mode: 'picnic', policy: 'keep-in-scene', rotation: 0, lift: 20 },
  'service-sparkle-party': { cycleMs: 2400, mode: 'one-hand', policy: 'fade-held-prop', rotation: 28, lift: 35 },
  'service-royal-celebration': { cycleMs: 4000, mode: 'effect', policy: 'hide-immediately', rotation: 0, lift: 25 },
  'service-grand-festival': { cycleMs: 3000, mode: 'effect', policy: 'hide-immediately', rotation: 0, lift: 40 },
};
export interface ActionInput {
  stage: GrowthStage; direction: PetDirection; intensity: AnimationIntensity; reduced: boolean;
  kind: PetInteractionKind; itemId: InventoryItemId | null; sequenceId: number; timeMs: number;
  durationMs?: number | null;
  motionWeight?: number; expression?: PetExpression; moving: boolean; drag?: DragVisual; keyboardTempo?: 'calm' | 'steady' | 'rapid';
}
export interface ActionFrame {
  pose: CharacterPose; phase: ContactPhase; cycleIndex: number; cycleProgress: number; safe: boolean;
  extras: Drawable[]; replaceArms: boolean; grips: { hand: Point; prop: Point }[]; policy: InterruptPolicy;
  expression?: PetExpression;
}
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };
const lerp = (a: number, b: number, t: number) => a+(b-a)*t;
const pointLerp = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t) });
export function contactPhaseAt(progress: number): ContactPhase {
  if (progress < .2) return 'approach';
  if (progress < .3) return 'acquire';
  if (progress < .72) return 'attached';
  if (progress < .84) return 'release';
  return 'retract';
}
export function gripMatrix(hand: Matrix, graphicGrip: Point, width: number, height = width): Matrix {
  return chain(hand, scale(width/512,height/512), translate(-graphicGrip.x,-graphicGrip.y));
}
function segment(id: string, from: Point, to: Point, slot: Drawable['slot'], root: string): Drawable {
  const length = Math.hypot(to.x-from.x,to.y-from.y);
  // A short source segment avoids extreme anisotropic minification in Chromium.
  return { id, slot, src: `${root}/segment.png`, width: 512, height: 512, matrix: chain(translate(from.x,from.y),rotate(Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI),scale(length/64,1),translate(-224,-256)) };
}
function authoredArms(input: ActionInput, pose: CharacterPose, hands: { left: Point; right: Point }, root: string): Drawable[] {
  const body = bodyMatrix(pose.body,input.direction);
  return (['left','right'] as const).flatMap(side => {
    const shoulder = transform(body,SHOULDERS[input.stage][side].shoulder);
    const hand = hands[side];
    const bend = .18*(side === 'left' ? 1 : -1)*(input.direction === 'left' ? -1 : 1);
    const elbow = { x: lerp(shoulder.x,hand.x,.5)-(hand.y-shoulder.y)*bend, y: lerp(shoulder.y,hand.y,.5)+(hand.x-shoulder.x)*bend };
    return [segment(`${side}-upper`,shoulder,elbow,'backArm',root), segment(`${side}-forearm`,elbow,hand,'frontArm',root),
      { id: `${side}-elbow`, slot: 'frontArm' as const, src: `${root}/hand.png`, width:512,height:512,matrix:chain(translate(elbow.x,elbow.y),translate(-256,-256)) },
      { id: `${side}-hand`, slot: 'handFront' as const, src: `${root}/hand.png`, width: 512, height: 512, matrix: chain(translate(hand.x,hand.y),translate(-256,-256)) }];
  });
}

export function actionAt(input: ActionInput, assetRoot = '/assets'): ActionFrame {
  const motion = input.motionWeight ?? (input.reduced ? 0 : 1);
  const still = motion === 0;
  const intensity = { gentle: .65, normal: 1, lively: 1.25 }[input.intensity];
  const seconds = Math.max(0,input.timeMs)/1000;
  const wave = motion*Math.sin(seconds*Math.PI*2/(input.moving ? .58/intensity : 3));
  const pose: CharacterPose = { body: { ...REST_POSE, y: still ? 0 : wave*(input.moving ? -12 : -5), rotation: still ? 0 : input.moving ? wave : 0 }, leftArm: input.moving && !still ? wave*17*intensity : 0, rightArm: input.moving && !still ? -wave*17*intensity : 0, leftLeg: still || !input.moving ? 0 : wave*9, rightLeg: still || !input.moving ? 0 : -wave*9 };
  const result: ActionFrame = { pose, phase: 'retract', cycleIndex: 0, cycleProgress: 0, safe: true, extras: [], replaceArms: false, grips: [], policy: 'hide-immediately' };
  if (input.kind === 'dragging') {
    const d = input.drag;
    const toAsset = 512/DISPLAY[input.stage].size;
    pose.body = { x: (d?.swayPx ?? 0)*toAsset, y: (d?.liftPx ?? -3)*toAsset, rotation: (d?.tiltDeg ?? 0)*motion, scaleX: still ? 1 : 1+((d?.stretchX ?? 1)-1)*motion, scaleY: still ? 1 : 1+((d?.stretchY ?? 1)-1)*motion };
    pose.leftArm = -27-(d?.limbSwingDeg ?? 3); pose.rightArm = -pose.leftArm;
    pose.leftLeg = 12; pose.rightLeg = -12; result.safe = false;
    return result;
  }
  if (input.kind === 'landing') {
    const p = Math.min(1,seconds/.65); const bounce = motion* Math.sin(p*Math.PI*2)*(1-p);
    pose.body = { x: 0, y: bounce*15, rotation: 0, scaleX: 1+bounce*.1, scaleY: 1-bounce*.14 };
    return result;
  }
  const keyboard = input.kind === 'keyboard-typing' || input.kind === 'keyboard-rest';
  const sample = sampleActionAt(input, assetRoot, authoredArms);
  if (sample) return sample;
  const cursor = input.kind === 'cursor-paw' || input.kind === 'cursor-tug';
  const item = input.itemId ? findInventoryItem(input.itemId) : null;
  const spec = input.itemId ? ACTIONS[input.itemId] : keyboard ? ACTIONS['item-mini-keyboard'] : cursor ? ACTIONS['item-mouse-feather'] : null;
  if (!spec) {
    if(input.kind==='idle' && (input.expression==='asleep'||input.expression==='sleepy')){
      pose.body.rotation=input.expression==='asleep'?-4:motion*Math.sin(seconds*2)*2;
      pose.body.scaleY=input.expression==='asleep'? .97 : 1;
    }
    if (!still && input.kind !== 'idle') {
      const amplitude:Partial<Record<PetInteractionKind,number>>={nearby:2,petting:5,dodge:8,'cursor-chase':3,'cursor-dizzy':12};
      pose.body.rotation = motion*Math.sin(seconds*5)*(amplitude[input.kind] ?? 2);
    }
    return result;
  }
  const cycleTime = Math.max(0,input.timeMs)/spec.cycleMs;
  const p = cycleTime-Math.floor(cycleTime);
  result.cycleIndex = Math.floor(cycleTime); result.cycleProgress = p;
  result.phase = contactPhaseAt(p); result.safe = p >= .84 || p < .04; result.policy = spec.policy;
  const reach = p < .3 ? smooth(p/.3) : p > .72 ? 1-smooth((p-.72)/.28) : 1;
  const contact = reach;
  const sway = motion*Math.sin(p*Math.PI*2);
  pose.body = { x: spec.mode === 'free' ? sway*10 : 0, y: spec.mode === 'scene' || spec.mode === 'picnic' ? 8 : -Math.max(0,sway)*spec.lift*.2, rotation: still ? 0 : sway*(spec.mode === 'effect' ? 5 : 2), scaleX: 1, scaleY: 1 };
  if(input.itemId==='item-citrus-cookie' && result.phase==='attached') {
    const chew=motion*Math.sin((p-.3)/.42*Math.PI*4);
    pose.body.scaleX=1+chew*.015;pose.body.scaleY=1-chew*.02;
  }
  if(input.itemId==='item-honey-soda') pose.body.rotation=-contact*4*motion;
  if(input.itemId==='service-sparkle-party') {pose.body.x=sway*12;pose.leftLeg=sway*10;pose.rightLeg=-sway*10;}
  if(input.itemId==='service-royal-celebration') {pose.body.scaleY=1-Math.max(0,sway)*.07;pose.body.y=Math.max(0,sway)*8;}
  if(input.itemId==='service-grand-festival') {pose.body.y=-Math.abs(sway)*14;pose.leftLeg=sway*12;pose.rightLeg=-sway*12;}
  const landmarks = BODY_LANDMARKS[input.stage];
  const mouth = { x: landmarks.eyes.x, y: {sprout:355,lively:340,mature:367,radiant:377}[input.stage] };
  const target = { x: spec.mode === 'one-hand' ? 320 : mouth.x, y: mouth.y+48-contact*spec.lift };
  const rig = bodyMatrix(pose.body,input.direction);
  const propAnchor = anchorMatrix(pose.body,input.direction,target,'rigid-anchor',contact*spec.rotation);
  const width = spec.mode === 'scene' || spec.mode === 'picnic' ? 116*512/DISPLAY[input.stage].size : spec.mode === 'effect' ? 220 : 200;
  let propMatrix = gripMatrix(propAnchor,{x:256,y:256},width);
  if (spec.mode === 'scene' || spec.mode === 'picnic') propMatrix = chain(translate(256,spec.mode === 'picnic' ? (168-DISPLAY[input.stage].y)*512/DISPLAY[input.stage].size : 418),scale(width/512),translate(-256,-256));
  if (spec.mode === 'effect') propMatrix = gripMatrix(anchorMatrix(pose.body,input.direction,{x:256,y:landmarks.top.y+25},'rigid-anchor',sway*spec.rotation),{x:256,y:256},width);
  const graphicGrips = input.kind==='cursor-tug'
    ? {left:{x:255,y:275},right:{x:290,y:320}}
    : input.itemId==='item-mouse-feather'||input.kind==='cursor-paw'
    ? {left:{x:160,y:395},right:{x:200,y:340}}
    : input.itemId === 'item-honey-soda'
    ? {left:{x:151,y:310},right:{x:360,y:310}}
    : input.itemId === 'service-cozy-grooming'
      ? {left:{x:205,y:402},right:{x:205,y:402}}
      : input.itemId === 'service-sparkle-party'
        ? {left:{x:174,y:380},right:{x:174,y:380}}
        : {left:{x:100,y:300},right:{x:412,y:300}};
  if (spec.mode === 'one-hand') propMatrix = gripMatrix(propAnchor,graphicGrips.right,width);
  if (spec.mode === 'free' && (p < .3 || p > .72)) {
    const initial = { x: 115, y: mouth.y-70 };
    const destination = transform(propAnchor,{x:0,y:0});
    const position = pointLerp(initial,destination,reach);
    propMatrix = chain(translate(position.x,position.y),scale(input.direction === 'left' ? -1 : 1,1),rotate(pose.body.rotation+contact*spec.rotation),scale(width/512),translate(-256,-256));
  }
  const grips = { left: transform(propMatrix,graphicGrips.left), right: transform(propMatrix,graphicGrips.right) };
  const hands = { ...grips };
  if (spec.mode === 'picnic') {
    const foodMatrix = gripMatrix(anchorMatrix(pose.body,input.direction,{x:mouth.x,y:mouth.y+52-contact*38},'rigid-anchor'),{x:256,y:256},100);
    for (const side of ['left','right'] as const) {
      const holdingSide=result.cycleIndex%2===0?'right':'left';
      if(side!==holdingSide){hands[side]=transform(rig,SHOULDERS[input.stage][side].hand);continue;}
      grips[side] = transform(foodMatrix,{x:side==='left'?125:385,y:300});
      hands[side] = pointLerp(transform(rig,SHOULDERS[input.stage][side].hand),grips[side],contact);
      if(result.phase==='attached') result.grips.push({hand:hands[side],prop:grips[side]});
    }
    result.extras.push({id:'picnic-food',slot:'heldObject',src:`${assetRoot}/props/rig/inventory/citrus-cookie.png`,matrix:foodMatrix,width:512,height:512});
  } else if (spec.mode === 'scene') {
    const beat = still ? 0 : Math.sin(seconds*2*Math.PI/(input.keyboardTempo === 'rapid' ? .18 : input.keyboardTempo === 'steady' ? .28 : .42));
    hands.left = { x: 210, y: 430 - Math.max(0,beat)*12 }; hands.right = { x: 302, y: 430-Math.max(0,-beat)*12 };
    if(input.direction==='left'){hands.left.x=512-hands.left.x;hands.right.x=512-hands.right.x;}
  } else if (spec.mode === 'effect' || spec.mode === 'wash') {
    hands.left = transform(rig,{ x: 180, y: landmarks.eyes.y + 30 + sway*20 });
    hands.right = transform(rig,{ x: 350, y: landmarks.eyes.y + 30 - sway*20 });
    if(input.itemId==='item-sunset-theme') {hands.left=transform(rig,{x:195,y:landmarks.eyes.y-28});hands.right=transform(rig,{x:390,y:landmarks.eyes.y+38});}
    if(input.itemId==='item-stage-sparkle'||input.itemId==='service-grand-festival') {
      hands.left=transform(rig,{x:120,y:landmarks.eyes.y+10-sway*30});hands.right=transform(rig,{x:400,y:landmarks.eyes.y+10+sway*30});
    }
  } else {
    for (const side of ['left','right'] as const) {
      if (spec.mode === 'one-hand' && side === 'left') { hands.left = transform(rig,SHOULDERS[input.stage].left.hand); continue; }
      hands[side] = pointLerp(transform(rig,SHOULDERS[input.stage][side].hand),grips[side],contact);
      if (result.phase === 'attached') result.grips.push({ hand: hands[side], prop: grips[side] });
    }
  }
  result.replaceArms = true;
  result.extras.push(...authoredArms(input,pose,hands,`${assetRoot}/pet/${input.stage}`));
  const file = input.itemId === 'service-cozy-grooming' ? 'inventory/grooming-brush.png' : item?.useVisual.assetFile ?? (keyboard ? 'mini-keyboard.png' : input.kind === 'cursor-tug' ? 'cursor-arrow.png' : 'inventory/mouse-feather.png');
  result.extras.push({ id: 'action-prop', slot: spec.mode==='picnic'?'backAccessory':'heldObject', src: `${assetRoot}/props/rig/${file}`, matrix: propMatrix, width: 512, height: 512, opacity: keyboard && input.kind === 'keyboard-rest' ? Math.max(0,1-seconds/.7) : 1 });
  if (spec.mode === 'effect' || spec.mode === 'wash' || input.itemId === 'service-sparkle-party') {
    if (!still) result.extras.push(...Array.from({length:8},(_,index) => particleAt(visualSeed(`${input.itemId}:${input.sequenceId}`),index,input.timeMs)));
  }
  return result;
}
