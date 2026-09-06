import type { PetDirection } from '../../shared/types';
import { anchorMatrix, bodyMatrix, chain, IDENTITY, rotate, scale, translate, type Matrix, type Pose } from './geometry';

export const RENDER_SLOTS = ['backFx', 'backAccessory', 'backArm', 'body', 'faceExpression', 'leaf', 'frontArm', 'frontAccessory', 'heldObject', 'handFront', 'mouthOccluder', 'frontFx'] as const;
export type RenderSlot = typeof RENDER_SLOTS[number];
export interface Drawable {
  id: string;
  slot: RenderSlot;
  matrix: Matrix;
  width: number;
  height: number;
  src?: string;
  color?: string;
  opacity?: number;
}
export function renderAssignments(drawables: readonly Drawable[]): Drawable[] {
  const ids = new Set<string>();
  for (const drawable of drawables) {
    if (ids.has(drawable.id)) throw new Error(`Duplicate drawable: ${drawable.id}`);
    if (!RENDER_SLOTS.includes(drawable.slot)) throw new Error(`Unknown render slot: ${drawable.slot}`);
    if (!drawable.matrix.every(Number.isFinite)) throw new Error(`Invalid transform: ${drawable.id}`);
    ids.add(drawable.id);
  }
  return [...drawables].sort((a, b) => RENDER_SLOTS.indexOf(a.slot)-RENDER_SLOTS.indexOf(b.slot));
}
export function visualSeed(key: string): number {
  let seed = 2166136261;
  for (const character of key) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function randomAt(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}
export function particleAt(seed: number, index: number, timeMs: number): Drawable {
  const phase = ((timeMs / 1800 + randomAt(seed, index)) % 1 + 1) % 1;
  return { id: `particle-${index}`, slot: 'frontFx', matrix: chain(translate(100 + randomAt(seed, index + 100) * 300, 450 - phase * 300), rotate(phase * 180)), width: 8, height: 8, color: '#f5c542', opacity: Math.sin(phase * Math.PI) };
}

/** Synthetic fixture exercises the production renderer before any PNG migration. */
export function gateFrame(timeMs: number, direction: PetDirection, seed: number): Drawable[] {
  const wave = Math.sin(timeMs / 1000 * Math.PI * 2);
  const pose: Pose = { x: wave * 8, y: wave * 12, rotation: wave * 30, scaleX: 1 + wave * .15, scaleY: 1 - wave * .15 };
  const body = bodyMatrix(pose, direction);
  const prop = anchorMatrix(pose, direction, { x: 256, y: 340 }, 'rigid-anchor', wave * 20);
  const box = (id: string, slot: RenderSlot, color: string, x: number, y: number, width: number, height: number): Drawable => ({ id, slot, color, matrix: chain(body, translate(x, y)), width, height });
  return renderAssignments([
    box('scarf-back', 'backAccessory', '#b74622', 116, 325, 280, 55),
    box('body', 'body', '#ff982e', 128, 185, 256, 260),
    box('arm', 'frontArm', '#ffc257', 105, 300, 145, 40),
    box('scarf-front', 'frontAccessory', '#db5422', 128, 350, 256, 30),
    { id: 'rigid-prop', slot: 'heldObject', matrix: chain(prop, translate(-40, -30)), width: 80, height: 60, color: '#73bdd2' },
    { id: 'hand', slot: timeMs < 500 ? 'frontArm' : 'handFront', matrix: chain(prop, translate(-48, -5)), width: 24, height: 24, color: '#ffe08d' },
    { id: 'rigid-crown', slot: 'frontAccessory', matrix: chain(anchorMatrix(pose, direction, { x: 256, y: 185 }, 'rigid-anchor'), translate(-55, -45)), width: 110, height: 45, color: '#e5b82e' },
    ...Array.from({ length: 8 }, (_, index) => particleAt(seed, index, timeMs)),
  ]);
}
