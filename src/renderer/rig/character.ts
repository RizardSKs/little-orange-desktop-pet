import type { GrowthStage, PetDirection, PetExpression } from '../../shared/types';
import stageData from './stage-data.json';
import { around, bodyMatrix, chain, rotate, transform, type Matrix, type Point, type Pose } from './geometry';
import { renderAssignments, type Drawable } from './frame';

export const SHOULDERS = stageData;
export function armMatrix(stage: GrowthStage, side: 'left' | 'right', angle: number): Matrix {
  const spec = SHOULDERS[stage][side];
  if (angle < spec.minAngle || angle > spec.maxAngle) throw new Error(`Arm angle outside verified envelope: ${stage}/${side}/${angle}`);
  return around(spec.shoulder, rotate(angle));
}
export function handPoint(stage: GrowthStage, side: 'left' | 'right', angle: number): Point {
  return transform(armMatrix(stage, side, angle), SHOULDERS[stage][side].hand);
}
export interface CharacterPose { body: Pose; leftArm: number; rightArm: number; leftLeg: number; rightLeg: number }
export function characterFrame(stage: GrowthStage, direction: PetDirection, expression: PetExpression, pose: CharacterPose, assetRoot: string, fallback = false): Drawable[] {
  const body = bodyMatrix(pose.body, direction);
  const layer = (id: string, slot: Drawable['slot'], matrix: Matrix, file: string): Drawable => ({ id, slot, matrix, src: `${assetRoot}/${stage}/${file}.png`, width: 512, height: 512 });
  if (fallback) return [{ ...layer('fallback', 'body', body, ''), src: `${assetRoot}/${stage}.png` }];
  return renderAssignments([
    layer('leg-left', 'backArm', chain(body, around({ x: 220, y: 450 }, rotate(pose.leftLeg))), 'leg-left'),
    layer('leg-right', 'backArm', chain(body, around({ x: 292, y: 450 }, rotate(pose.rightLeg))), 'leg-right'),
    layer('arm-left', 'backArm', chain(body, armMatrix(stage, 'left', pose.leftArm)), 'arm-left'),
    layer('arm-right', 'backArm', chain(body, armMatrix(stage, 'right', pose.rightArm)), 'arm-right'),
    layer('body', 'body', body, 'torso'),
    layer('leaves', 'leaf', body, 'leaves'),
    layer('expression', 'faceExpression', body, `expressions/${expression}`),
  ]);
}
