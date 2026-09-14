import type { ActionFrame, ActionInput } from './actions';
import { CARE_DURATION_MS, CARE_SLEEP_CYCLE_MS } from '../../shared/care';
import { BODY_LANDMARKS } from './attachments';
import { SHOULDERS, type CharacterPose } from './character';
import { anchorMatrix, bodyMatrix, chain, facing, REST_POSE, rotate, scale, transform, translate, type Point } from './geometry';
import type { Drawable } from './frame';

type Arms = (input: ActionInput, pose: CharacterPose, hands: { left: Point; right: Point }, root: string) => Drawable[];
const smooth = (x: number) => { const p = Math.max(0, Math.min(1, x)); return p * p * (3 - 2 * p); };
const blend = (a: Point, b: Point, p: number): Point => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const beat = (p: number, a: number, b: number, c: number, d: number) => smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)));
export const CARE_MOUTH_Y = { sprout: 355, lively: 340, mature: 367, radiant: 377 };

/** Complete stories, evaluated from authoritative elapsed time, never an animation callback. */
export function careActionAt(input: ActionInput, root: string, arms: Arms): ActionFrame | null {
  if (input.kind !== 'care' || !input.careAction) return null;
  const action = input.careAction;
  const loop = action === 'sleep-loop';
  const duration = input.durationMs && input.durationMs > 0 ? input.durationMs : CARE_DURATION_MS[action] ?? CARE_SLEEP_CYCLE_MS;
  const t = Math.max(0, input.timeMs);
  const p = Math.min(1, t / duration);
  const variant = Math.abs(input.careVariant ?? input.sequenceId) % 3;
  const weight = input.motionWeight ?? (input.reduced ? 0 : 1);
  const motion = weight * { gentle: .65, normal: 1, lively: 1.2 }[input.intensity];
  const temperament = { sprout: .7, lively: 1.1, mature: .8, radiant: 1 }[input.stage];
  const pose: CharacterPose = { body: { ...REST_POSE }, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
  const sleep = action === 'sleep-in' || loop;
  const enter = loop ? 1 : action === 'wake' ? 1 : smooth(p / .18);
  const release = loop || action === 'sleep-in' ? 0 : smooth((p - .83) / .15);
  const envelope = enter * (1 - release);
  const frame: ActionFrame = { pose, phase: loop ? 'attached' : p < .18 ? 'acquire' : p < .83 ? 'attached' : 'retract',
    cycleIndex: loop ? Math.floor(t / CARE_SLEEP_CYCLE_MS) : 0, cycleProgress: loop ? (t % CARE_SLEEP_CYCLE_MS) / CARE_SLEEP_CYCLE_MS : p,
    safe: !loop && (p < .04 || p >= .98), extras: [], grips: [], replaceArms: true, policy: 'fade-held-prop', expression: 'curious' };
  if (!loop && p >= 1 && action !== 'sleep-in') { frame.replaceArms = false; frame.expression = 'neutral'; return frame; }
  const landmarks = BODY_LANDMARKS[input.stage];
  const mouth = { x: landmarks.eyes.x, y: CARE_MOUTH_Y[input.stage] };
  let left: Point = { ...SHOULDERS[input.stage].left.hand };
  let right: Point = { ...SHOULDERS[input.stage].right.hand };
  let propPoint: Point = { x: 256, y: 426 };
  let propWidth = 180;
  let propAngle = 0;
  let file = 'care/bowl.png';
  let opacity = envelope;
  let grip = envelope;
  let sceneProp = false;
  let graphic = { left: { x: 130, y: 310 }, right: { x: 382, y: 310 } };

  if (action === 'feed') {
    const sniff = beat(p, .12, .2, .25, .3);
    const first = beat(p, .27, .34, .42, .48);
    const second = beat(p, .49, .56, .65, .7);
    const chew = (first + second) * Math.sin(p * Math.PI * 28);
    const wipe = beat(p, .71, .76, .8, .85);
    pose.body.rotation = motion * (sniff * 3 - wipe * 2);
    pose.body.y = motion * (-sniff * 3 + chew * 1.7);
    pose.body.scaleY = 1 + motion * chew * .006;
    propPoint = { x: mouth.x, y: mouth.y + 55 - (first + second) * 5 };
    frame.expression = p < .18 ? 'curious' : p < .7 ? 'delighted' : input.stage === 'mature' ? 'proud' : 'happy';
    if (variant === 1 && p > .18 && p < .27) frame.expression = 'focused';
    if (variant === 2) pose.body.rotation += motion * beat(p, .67, .71, .73, .78) * 4;
    // A bite leaves the bowl only after the hand reaches it, then touches the mouth.
    const bite = Math.max(first, second);
    const food = blend({ x: propPoint.x + 18, y: propPoint.y - 17 }, mouth, bite);
    const foodMatrix = chain(anchorMatrix(pose.body, input.direction, food, 'rigid-anchor'), scale(70 / 512), translate(-256, -115));
    if (p > .22 && p < .71 && !input.hideCareProps) frame.extras.push({ id: 'care-food', slot: 'heldObject', src: `${root}/props/rig/care/bread.png`, matrix: foodMatrix, width: 512, height: 512, opacity: beat(p, .22, .27, .66, .71) });
    right = { x: food.x + (350 - 256) * 70 / 512, y: food.y + (330 - 115) * 70 / 512 };
    right = blend(right, { x: mouth.x + 12, y: mouth.y + 3 }, wipe);
    if (bite > .99 && !input.hideCareProps) frame.extras.push({ id: 'care-mouth', slot: 'mouthOccluder', src: `${root}/pet/${input.stage}/mouth-delighted.png`, matrix: bodyMatrix(pose.body, input.direction), width: 512, height: 512 });
  } else if (action === 'play') {
    file = 'inventory/ribbon-ball.png'; propWidth = 150; sceneProp = true;
    graphic = { left: { x: 135, y: 290 }, right: { x: 325, y: 290 } };
    const throwP = smooth((p - .22) / .27);
    const airborne = p >= .22 && p < .49;
    const catchP = smooth((p - .49) / .12);
    const reach = beat(p, .1, .19, .2, .25);
    const celebrate = beat(p, .65, .7, .76, .83);
    const sign = variant === 1 ? -1 : 1;
    propPoint = airborne ? { x: 256 + sign * Math.sin(throwP * Math.PI) * 85 * weight, y: 415 - Math.sin(throwP * Math.PI) * 90 * weight }
      : { x: 256 + (variant === 2 ? Math.sin(catchP * Math.PI * 2) * 15 * weight : 0), y: 415 - catchP * 15 };
    propAngle = airborne ? throwP * 160 * motion * sign : 0;
    grip = airborne ? 0 : envelope * (p < .22 ? reach : catchP);
    pose.body.y = motion * temperament * (reach * 5 - celebrate * (input.stage === 'lively' ? 14 : 7));
    pose.body.rotation = motion * sign * (airborne ? Math.sin(throwP * Math.PI) * -5 : celebrate * 3);
    pose.leftLeg = motion * celebrate * 8; pose.rightLeg = -pose.leftLeg;
    left = { x: 190 - sign * 15 * reach, y: 395 - 25 * reach };
    right = { x: 320 - sign * 15 * reach, y: 380 - 30 * reach };
    frame.expression = p < .22 ? 'focused' : airborne ? 'excited' : variant === 2 && p < .6 ? 'surprised' : 'happy';
  } else if (action === 'clean') {
    file = 'care/washcloth.png'; propWidth = 115;
    graphic = { left: { x: 256, y: 330 }, right: { x: 256, y: 330 } };
    const face = variant === 1 ? beat(p, .43, .5, .58, .64) : beat(p, .18, .24, .37, .44);
    const wipe = Math.sin(p * Math.PI * 22) * motion;
    propPoint = { x: mouth.x + 46 - face * 5, y: mouth.y + 45 - face * 46 + wipe * 5 * envelope };
    propAngle = face * -12 + wipe * 5;
    pose.body.rotation = motion * (-face * 4 + beat(p, .65, .7, .75, .8) * Math.sin(p * 60) * 3);
    frame.expression = face > .8 ? (variant === 2 ? 'asleep' : 'refreshed') : p < .65 ? 'focused' : 'proud';
    left = { x: 190, y: 365 + 10 * face };
    if (variant === 2) {
      const inspect = beat(p, .48, .53, .58, .64);
      propPoint.x += inspect * 25;
      left = blend(left, { x: 210, y: mouth.y + 25 }, inspect);
      if (inspect > .5) frame.expression = 'curious';
    }
    if (weight > 0 && p > .25 && p < .65) for (let i = 0; i < 3; i++) {
      const q = ((p * 4 + i / 3) % 1);
      frame.extras.push({ id: `care-bubble-${i}`, slot: 'frontFx', color: '#b9eced', matrix: chain(facing(input.direction), translate(propPoint.x + 12 + i * 6, propPoint.y - q * 20)), width: 4 + i, height: 4 + i, opacity: (1 - q) * .6 * weight });
    }
  } else {
    file = 'care/pillow.png'; propWidth = 220;
    graphic = { left: { x: 82, y: 295 }, right: { x: 430, y: 295 } };
    const nest = loop ? 1 : action === 'wake' ? 1 - smooth(p / .65) : smooth((p - .3) / .6);
    const breath = Math.sin((t - (action === 'sleep-in' ? duration : 0)) / 1000 * Math.PI * 2 / 4.8);
    const cycle = (t % CARE_SLEEP_CYCLE_MS) / CARE_SLEEP_CYCLE_MS;
    const adjust = loop ? beat(cycle, .72, .78, .81, .88) : 0;
    pose.body.y = nest * 8 + nest * motion * breath * 1.4;
    pose.body.rotation = nest * (variant === 1 ? 5 : -5) + adjust * motion * 2;
    pose.body.scaleY = 1 - nest * .025;
    pose.leftLeg = nest * 12; pose.rightLeg = -nest * 12;
    propPoint = { x: mouth.x, y: mouth.y + 42 - adjust * 5 * motion };
    if (action === 'sleep-in' && variant === 2) {
      const tuck = beat(p, .36, .43, .5, .59);
      propPoint.y -= tuck * 12;
      pose.body.rotation -= tuck * 3 * motion;
      frame.expression = 'happy';
    }
    opacity = loop ? 1 : sleep ? smooth((p - .26) / .12) : 1 - smooth((p - .25) / .18);
    if (action === 'wake') propPoint.y += smooth(p / .38) * 38;
    grip = opacity;
    frame.expression = loop || sleep && p > .65 ? 'asleep' : action === 'wake' && p > .4 ? 'happy' : 'sleepy';
    const rub = sleep && !loop ? beat(p, .05, .13, .25, .34) : action === 'wake' && variant === 1 ? beat(p, .1, .18, .25, .35) : 0;
    if (variant === 1) left = blend(left, { x: landmarks.eyes.x - 30, y: landmarks.eyes.y + 6 }, rub);
    else right = blend(right, { x: landmarks.eyes.x + 28, y: landmarks.eyes.y + 6 }, rub);
    const stretch = action === 'wake' ? beat(p, .43, .54, .68, .82) : 0;
    if (stretch > 0) {
      grip *= 1 - stretch;
      left = blend(left, { x: 160, y: 225 + (variant === 2 ? 25 : 0) }, stretch);
      right = blend(right, { x: 345, y: 225 }, stretch);
      pose.body.y -= stretch * 6 * motion;
    }
    frame.safe = loop ? adjust === 0 && cycle < .12 : sleep ? p < .04 || p >= .98 : p >= .98;
  }

  const body = bodyMatrix(pose.body, input.direction);
  const rest = { left: transform(body, SHOULDERS[input.stage].left.hand), right: transform(body, SHOULDERS[input.stage].right.hand) };
  const matrix = sceneProp
    ? chain(facing(input.direction), translate(propPoint.x, propPoint.y), rotate(propAngle), scale(propWidth / 512), translate(-256, -256))
    : chain(anchorMatrix(pose.body, input.direction, propPoint, 'rigid-anchor', propAngle), scale(propWidth / 512), translate(-256, -256));
  const hands = { left: blend(rest.left, transform(body, left), envelope), right: blend(rest.right, transform(body, right), envelope) };
  if (!input.hideCareProps) {
    for (const side of ['left', 'right'] as const) {
      if (action === 'feed' && side === 'right' || action === 'clean' && side === 'left') continue;
      const point = transform(matrix, graphic[side]);
      hands[side] = blend(hands[side], point, grip);
      if (grip === 1) frame.grips.push({ hand: hands[side], prop: point });
    }
    if (opacity > 0) frame.extras.push({ id: 'action-prop', slot: 'heldObject', src: `${root}/props/rig/${file}`, matrix, width: 512, height: 512, opacity });
  } else {
    // Recognizable fallback: tasting, catching, wiping or resting without an invisible prop.
    const gesture = action === 'feed' ? mouth : action === 'clean' ? { x: mouth.x + 35, y: mouth.y - 25 } : { x: 285, y: 390 };
    hands.right = blend(rest.right, transform(body, gesture), envelope);
    hands.left = blend(rest.left, transform(body, { x: 210, y: 400 }), envelope);
  }
  if (!loop && action !== 'sleep-in' && p >= .98) frame.replaceArms = false;
  else frame.extras.push(...arms(input, pose, hands, `${root}/pet/${input.stage}`));
  return frame;
}
