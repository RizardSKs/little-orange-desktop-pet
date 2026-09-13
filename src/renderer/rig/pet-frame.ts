import type { PetExpression } from '../../shared/types';
import type { OutfitId } from '../outfit-layout';
import { actionAt, type ActionInput } from './actions';
import { characterFrame } from './character';
import { attachmentDrawables, outfitSpec } from './attachments';
import { renderAssignments } from './frame';
import { bodyMatrix } from './geometry';
import type { TravelOutfitId } from '../../shared/economy-types';
import { travelDrawables } from './travel';

export function petFrame(input: ActionInput, outfit: OutfitId | null, expression: PetExpression, root: string, fallback = false, travel: TravelOutfitId | null = null) {
  const action = actionAt(input,root);
  const character = characterFrame(input.stage,input.direction,action.expression ?? expression,action.pose,`${root}/pet`,fallback)
    .filter(part => fallback || !action.replaceArms || !['arm-left','arm-right'].includes(part.id));
  if (!travel && outfit && (!fallback || ['glasses','bow','leaf-clip','halo'].includes(outfit))) character.push(...attachmentDrawables(outfitSpec(input.stage,outfit),`outfit-${outfit}`,action.pose.body,input.direction,`${root}/outfits`));
  if(travel && !fallback) character.push(...travelDrawables(input.stage,travel,action.pose.body,input.direction,root));
  if (!fallback) character.push(...action.extras);
  if (!fallback && action.phase === 'attached' && ['item-citrus-cookie','item-honey-soda'].includes(input.itemId ?? '')) {
    const mouthExpression = input.itemId === 'item-honey-soda' ? 'refreshed' : 'delighted';
    character.push({id:'mouth-contact',slot:'mouthOccluder',src:`${root}/pet/${input.stage}/mouth-${mouthExpression}.png`,matrix:bodyMatrix(action.pose.body,input.direction),width:512,height:512});
  }
  return { ...action, drawables: renderAssignments(character) };
}
