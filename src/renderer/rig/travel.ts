import type { GrowthStage, PetDirection } from '../../shared/types';
import type { TravelOutfitId } from '../../shared/economy-types';
import type { Pose } from './geometry';
import { attachmentDrawables, BODY_LANDMARKS, type AttachmentSpec } from './attachments';

export const TRAVEL_IDS: readonly TravelOutfitId[] = ['travel-satchel','travel-raincoat','travel-star-cape','travel-grand-backpack'];
export function travelSpecs(stage: GrowthStage, id: TravelOutfitId): AttachmentSpec[] {
  const b=BODY_LANDMARKS[stage];
  const base:AttachmentSpec={space:'body',mirrorPolicy:'with-character',inheritance:'rigid-anchor',anchor:{x:256,y:b.eyes.y+45},graphicAnchor:{x:256,y:256},width:b.width,height:245,rotation:0,layers:[]};
  switch(id) {
    case 'travel-satchel': return [
      {...base,inheritance:'full',anchor:{x:256,y:b.neck.y-20},height:140,layers:[{file:'satchel-strap.png',slot:'frontAccessory'}]},
      {...base,anchor:{x:365,y:b.neck.y},width:130,height:130,layers:[{file:'satchel-bag.png',slot:'frontAccessory'}]},
    ];
    case 'travel-grand-backpack': return [
      {...base,anchor:{x:360,y:b.eyes.y+38},width:190,height:220,layers:[{file:'backpack-bag.png',slot:'backAccessory'}]},
      {...base,inheritance:'full',anchor:{x:256,y:b.neck.y-8},height:185,layers:[{file:'backpack-straps.png',slot:'frontAccessory'}]},
    ];
    case 'travel-star-cape': return [
      {...base,width:b.width+90,height:250,anchor:{x:256,y:b.eyes.y+25},layers:[{file:'cape-back.png',slot:'backAccessory'}]},
      {...base,inheritance:'full',height:190,anchor:{x:256,y:b.neck.y+22},layers:[{file:'cape-collar.png',slot:'frontAccessory'}]},
    ];
    case 'travel-raincoat': return [{...base,inheritance:'full',width:b.width*1.25,height:330,anchor:{x:256,y:b.eyes.y+12},layers:[{file:'raincoat-front.png',slot:'frontAccessory'}]}];
  }
}
export function travelDrawables(stage:GrowthStage,id:TravelOutfitId,pose:Pose,direction:PetDirection,root:string) {
  return travelSpecs(stage,id).flatMap((spec,index)=>attachmentDrawables(spec,`travel-${index}`,pose,direction,`${root}/outfits/travel`));
}
