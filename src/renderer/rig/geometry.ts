import type { GrowthStage, PetDirection } from '../../shared/types';

export interface Point { x: number; y: number }
export type Matrix = readonly [number, number, number, number, number, number];
export interface Pose { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
export type PoseInheritance = 'full' | 'rigid-anchor' | 'translation-rotation';
export type AttachmentSpace = 'body' | 'head' | 'leftHand' | 'rightHand' | 'scene' | 'free';
export type MirrorPolicy = 'with-character' | 'counter-mirror' | 'alternate-layout' | 'no-mirror';
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export const REST_POSE: Pose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
export const STAGES: readonly GrowthStage[] = ['sprout', 'lively', 'mature', 'radiant'];
export const DISPLAY: Record<GrowthStage, { size: number; x: number; y: number }> = {
  sprout: { size: 146, x: 38, y: 67 }, lively: { size: 163, x: 29, y: 50 },
  mature: { size: 170, x: 25, y: 46 }, radiant: { size: 170, x: 25, y: 45 },
};

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function chain(...matrices: Matrix[]): Matrix { return matrices.reduce(multiply, IDENTITY); }
export function translate(x: number, y: number): Matrix { return [1, 0, 0, 1, x, y]; }
export function scale(x: number, y = x): Matrix { return [x, 0, 0, y, 0, 0]; }
export function rotate(degrees: number): Matrix {
  const radians = degrees * Math.PI / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
}
export function transform(matrix: Matrix, point: Point): Point {
  return { x: matrix[0]*point.x + matrix[2]*point.y + matrix[4], y: matrix[1]*point.x + matrix[3]*point.y + matrix[5] };
}
export function inverse(m: Matrix): Matrix {
  const determinant = m[0]*m[3]-m[1]*m[2];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('Singular rig transform');
  return [m[3]/determinant, -m[1]/determinant, -m[2]/determinant, m[0]/determinant, (m[2]*m[5]-m[3]*m[4])/determinant, (m[1]*m[4]-m[0]*m[5])/determinant];
}
export function around(point: Point, matrix: Matrix): Matrix { return chain(translate(point.x, point.y), matrix, translate(-point.x, -point.y)); }
export function facing(direction: PetDirection): Matrix { return direction === 'left' ? chain(translate(512, 0), scale(-1, 1)) : IDENTITY; }
export function bodyMatrix(pose: Pose, direction: PetDirection): Matrix {
  return chain(facing(direction), translate(pose.x, pose.y), around({ x: 256, y: 480 }, chain(rotate(pose.rotation), scale(pose.scaleX, pose.scaleY))));
}
export function displayMatrix(stage: GrowthStage): Matrix {
  const display = DISPLAY[stage];
  return chain(translate(display.x, display.y), scale(display.size / 512));
}
export function sceneToWindow(stage: GrowthStage, point: Point): Point { return transform(displayMatrix(stage), point); }
export function windowToScene(stage: GrowthStage, point: Point): Point { return transform(inverse(displayMatrix(stage)), point); }
export function assetToWindow(stage: GrowthStage, assetToScene: Matrix, point: Point): Point { return sceneToWindow(stage, transform(assetToScene, point)); }
export function windowToAsset(stage: GrowthStage, assetToScene: Matrix, point: Point): Point { return transform(inverse(assetToScene), windowToScene(stage, point)); }

// Position follows squash, orientation comes from authored angles, never affine decomposition.
export function anchorMatrix(pose: Pose, direction: PetDirection, anchor: Point, inheritance: PoseInheritance, localRotation = 0): Matrix {
  const effectivePose = inheritance === 'translation-rotation' ? { ...pose, scaleX: 1, scaleY: 1 } : pose;
  const body = bodyMatrix(effectivePose, direction);
  if (inheritance === 'full') return chain(body, translate(anchor.x, anchor.y), rotate(localRotation));
  const position = transform(body, anchor);
  return chain(translate(position.x, position.y), scale(direction === 'left' ? -1 : 1, 1), rotate(pose.rotation + localRotation));
}
export function cssMatrix(matrix: Matrix): string { return `matrix(${matrix.join(',')})`; }
