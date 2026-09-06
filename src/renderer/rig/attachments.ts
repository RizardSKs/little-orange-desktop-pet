import type { GrowthStage, PetDirection } from '../../shared/types';
import { OUTFIT_IDS, type OutfitId } from '../outfit-layout';
import { anchorMatrix, chain, scale, translate, type AttachmentSpace, type MirrorPolicy, type Point, type Pose, type PoseInheritance } from './geometry';
import type { Drawable, RenderSlot } from './frame';

export interface AttachmentSpec {
  space: AttachmentSpace;
  mirrorPolicy: MirrorPolicy;
  inheritance: PoseInheritance;
  anchor: Point;
  graphicAnchor: Point;
  width: number;
  height: number;
  rotation: number;
  layers: readonly { file: string; slot: RenderSlot }[];
}
export const BODY_LANDMARKS: Record<GrowthStage, { eyes: Point; eyeGap: number; top: Point; neck: Point; width: number }> = {
  sprout: { eyes: { x: 262, y: 302 }, eyeGap: 120, top: { x: 260, y: 170 }, neck: { x: 260, y: 393 }, width: 312 },
  lively: { eyes: { x: 270, y: 296 }, eyeGap: 97, top: { x: 257, y: 185 }, neck: { x: 257, y: 394 }, width: 254 },
  mature: { eyes: { x: 281, y: 326 }, eyeGap: 106, top: { x: 256, y: 225 }, neck: { x: 256, y: 410 }, width: 304 },
  radiant: { eyes: { x: 278, y: 340 }, eyeGap: 113, top: { x: 257, y: 249 }, neck: { x: 257, y: 425 }, width: 287 },
};
export function outfitSpec(stage: GrowthStage, id: OutfitId): AttachmentSpec {
  const body = BODY_LANDMARKS[stage];
  const front = [{ file: `${id}.png`, slot: 'frontAccessory' as const }];
  const split = [{ file: `layers/${id}-back.png`, slot: 'backAccessory' as const }, { file: `layers/${id}-front.png`, slot: 'frontAccessory' as const }];
  const base: AttachmentSpec = { space: 'head', mirrorPolicy: 'with-character', inheritance: 'rigid-anchor', anchor: body.top, graphicAnchor: { x: 256, y: 360 }, width: 210, height: 170, rotation: 0, layers: front };
  const specs: Record<OutfitId, AttachmentSpec> = {
    'top-hat': { ...base, layers: split },
    crown: { ...base, width: 205, height: 150, layers: split },
    glasses: { ...base, anchor: body.eyes, graphicAnchor: { x: 256, y: 256 }, width: body.eyeGap/244*512, height: body.eyeGap/244*512 },
    headphones: { ...base, anchor: { x: 256, y: body.eyes.y }, graphicAnchor: { x: 256, y: 330 }, width: body.width + 165, height: 320, layers: split },
    scarf: { ...base, space: 'body', inheritance: 'full', anchor: body.neck, graphicAnchor: { x: 256, y: 180 }, width: body.width*.96, height: 160, layers: split },
    halo: { ...base, anchor: { x: 256, y: 30 }, graphicAnchor: { x: 256, y: 256 }, width: 220, height: 150 },
    'leaf-clip': { ...base, anchor: { x: 171, y: body.top.y - 49 }, graphicAnchor: { x: 256, y: 256 }, width: 105, height: 105, rotation: -18 },
    bow: { ...base, anchor: { x: 358, y: body.top.y + 35 }, graphicAnchor: { x: 256, y: 256 }, width: 113, height: 113, rotation: 10 },
  };
  return specs[id];
}
export function attachmentDrawables(spec: AttachmentSpec, id: string, pose: Pose, direction: PetDirection, root: string): Drawable[] {
  const attachment = anchorMatrix(pose, spec.mirrorPolicy === 'no-mirror' ? 'right' : direction, spec.anchor, spec.inheritance, spec.rotation);
  const compensation = spec.mirrorPolicy === 'counter-mirror' && direction === 'left' ? -1 : 1;
  const matrix = chain(attachment, scale(compensation, 1), scale(spec.width/512, spec.height/512), translate(-spec.graphicAnchor.x, -spec.graphicAnchor.y));
  return spec.layers.map(({ file, slot }, index) => ({ id: `${id}-${index}`, slot, matrix, src: `${root}/${file}`, width: 512, height: 512 }));
}
export { OUTFIT_IDS };
