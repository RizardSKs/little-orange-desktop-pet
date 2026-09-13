import type { ActionFrame, ActionInput } from './actions';
import { findInventoryItem } from '../../shared/catalog';
import { BODY_LANDMARKS } from './attachments';
import { SHOULDERS, type CharacterPose } from './character';
import { anchorMatrix, bodyMatrix, chain, DISPLAY, REST_POSE, rotate, scale, transform, translate, type Point } from './geometry';
import type { Drawable } from './frame';

export const SAMPLE_IDS = ['item-honey-soda', 'item-ribbon-ball', 'service-cozy-grooming', 'item-mini-keyboard'] as const;
export const SAMPLE_TIMING = { enterMs: 900, closeMs: 1400, fadeMs: 200 } as const;
const smooth = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
const mix = (a: Point, b: Point, p: number): Point => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
type Arms = (input: ActionInput, pose: CharacterPose, hands: { left: Point; right: Point }, root: string) => Drawable[];

/** Finite inventory choreography. Seeking uses elapsed time; it never replays missed beats. */
export function sampleActionAt(input: ActionInput, root: string, arms: Arms): ActionFrame | null {
  const item = input.itemId ? findInventoryItem(input.itemId) : null;
  if (input.kind !== 'inventory-use' || !item || !SAMPLE_IDS.some(id => id === item.id)) return null;
  const duration = input.durationMs != null && Number.isFinite(input.durationMs) && input.durationMs > 0
    ? input.durationMs : item.useVisual.durationMs;
  const t = Math.max(0, input.timeMs);
  // Compress the entire story together if the controller supplies a shorter deadline.
  const unit = Math.min(1, duration / (SAMPLE_TIMING.enterMs + SAMPLE_TIMING.closeMs + 1000));
  const enter = SAMPLE_TIMING.enterMs * unit, close = SAMPLE_TIMING.closeMs * unit;
  const endUse = duration - close;
  const acquire = smooth((t - enter * .3) / (enter * .7));
  const release = smooth((t - endUse) / (close * .7));
  const contact = acquire * (1 - release);
  const opacity = smooth(t / (SAMPLE_TIMING.fadeMs * unit)) * (1 - smooth((t - (duration - close * .3)) / (close * .2)));
  const active = t >= enter && t < endUse;
  const motion = (input.motionWeight ?? (input.reduced ? 0 : 1)) * ({ gentle: .65, normal: 1, lively: 1.25 }[input.intensity]);
  const elapsed = Math.max(0, t - enter);
  const pose: CharacterPose = { body: { ...REST_POSE }, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
  const frame: ActionFrame = {
    pose, phase: t < enter * .3 ? 'approach' : t < enter ? 'acquire' : t < endUse ? 'attached' : release < 1 ? 'release' : 'retract',
    cycleIndex: 0, cycleProgress: Math.min(1, t / duration), safe: t < enter * .3 || opacity === 0,
    extras: [], grips: [], replaceArms: opacity > 0,
    policy: item.id === 'item-mini-keyboard' ? 'keep-in-scene' : item.id === 'item-ribbon-ball' ? 'resume-free-motion' : 'fade-held-prop',
    expression: t < enter ? 'curious' : active ? (item.id === 'item-mini-keyboard' ? 'focused' : item.id === 'service-cozy-grooming' ? 'happy' : item.useVisual.expression) : 'happy',
  };
  if (t >= duration || opacity === 0) { frame.expression = 'neutral'; return frame; }
  const landmarks = BODY_LANDMARKS[input.stage];
  const mouth = { x: landmarks.eyes.x, y: { sprout: 355, lively: 340, mature: 367, radiant: 377 }[input.stage] };
  const wave = Math.sin(elapsed / 1000 * Math.PI * 2 / 2.4);
  pose.body.rotation = item.id === 'service-cozy-grooming' ? -contact * motion * 2 : 0;
  pose.body.y = item.id === 'item-mini-keyboard' ? contact * 4 : -contact * motion * (1 - Math.cos(elapsed / 1000 * Math.PI * 2 / 2.4)) * 1.5;
  const body = bodyMatrix(pose.body, input.direction);
  const rest = { left: transform(body, SHOULDERS[input.stage].left.hand), right: transform(body, SHOULDERS[input.stage].right.hand) };
  const hands = { ...rest };
  let graphic = { left: { x: 151, y: 310 }, right: { x: 360, y: 310 } };
  let matrix;
  let file = item.useVisual.assetFile;
  if (item.id === 'item-honey-soda') {
    // This PNG has a straw: the mouth contact is the straw tip, not the cup centre.
    const sip = contact * (1 - .2 * Math.min(1, motion) * (1 - smooth((wave + .3) / .8)));
    const tip = mix({ x: mouth.x + 48, y: mouth.y + 6 }, mouth, sip);
    matrix = chain(anchorMatrix(pose.body, input.direction, tip, 'rigid-anchor', -65), scale(200 / 512), translate(-354, -34));
  } else if (item.id === 'service-cozy-grooming') {
    file = 'inventory/grooming-brush.png';
    graphic = { left: { x: 205, y: 402 }, right: { x: 205, y: 402 } };
    // One visible cheek region; the handle follows the brush head without stretching.
    const beat = elapsed % 4200;
    const brushing = smooth(beat / 250) * (1 - smooth((beat - 2500) / 350));
    const stroke = motion * contact * 7 * wave * brushing;
    if (active) frame.expression = brushing > .5 ? 'happy' : 'curious';
    const head = mix({ x: landmarks.eyes.x + 108, y: landmarks.eyes.y + 65 }, { x: landmarks.eyes.x + 76 + (1 - brushing) * 8 * motion, y: landmarks.eyes.y + 40 + stroke }, contact);
    matrix = chain(anchorMatrix(pose.body, input.direction, head, 'rigid-anchor', contact * 8), scale(200 / 512), translate(-118, -205));
  } else if (item.id === 'item-mini-keyboard') {
    // A scene object never inherits breathing, facing, or the body's lean.
    const width = 116 * 512 / DISPLAY[input.stage].size;
    matrix = chain(translate(256, 418), scale(width / 512), translate(-256, -256));
    graphic = { left: { x: 195, y: 290 }, right: { x: 310, y: 290 } };
  } else {
    // Rolling path is owned by the scene; hands approach only during the stop.
    const p = (elapsed % 3000) / 3000;
    const roll = p < .25 ? 1 - smooth(p / .25) : p < .55 ? 0 : smooth((p - .55) / .45);
    const settle = smooth(elapsed / 500);
    const x = 170 - 45 * roll * settle * motion;
    matrix = chain(translate(input.direction === 'left' ? 512 - x : x, 412), scale(input.direction === 'left' ? -1 : 1, 1), rotate(-roll * settle * 18 * motion), scale(200 / 512), translate(-217, -272));
    graphic = { left: { x: 353, y: 300 }, right: { x: 353, y: 300 } };
    const stop = smooth(p / .25) * (1 - smooth((p - .55) / .15));
    const grip = transform(matrix, graphic.left);
    const handContact = contact * (1 - Math.min(1, motion) * (1 - stop));
    hands.left = mix(rest.left, grip, handContact);
    if (active && handContact === 1) frame.grips.push({ hand: hands.left, prop: grip });
  }
  if (item.id !== 'item-ribbon-ball') {
    for (const side of ['left', 'right'] as const) {
      if (item.id === 'service-cozy-grooming' && side === 'left') continue;
      const graphicSide = item.id === 'item-mini-keyboard' && input.direction === 'left' ? (side === 'left' ? 'right' : 'left') : side;
      const grip = transform(matrix, graphic[graphicSide]);
      hands[side] = mix(rest[side], grip, contact);
      if (item.id === 'item-mini-keyboard') {
        const beat = Math.sin(elapsed / 1000 * Math.PI * 2 / .56 + (side === 'left' ? 0 : Math.PI));
        // A short typing burst followed by a pause gives the gesture a readable rhythm.
        const burst = smooth((elapsed % 2800) / 200) * (1 - smooth(((elapsed % 2800) - 1700) / 300));
        hands[side].y -= Math.max(0, beat) * 9 * motion * contact * burst;
      } else if (active) frame.grips.push({ hand: hands[side], prop: grip });
    }
  }
  frame.extras.push(...arms(input, pose, hands, `${root}/pet/${input.stage}`));
  frame.extras.push({ id: 'action-prop', slot: 'heldObject', src: `${root}/props/rig/${file}`, matrix, width: 512, height: 512, opacity });
  return frame;
}
