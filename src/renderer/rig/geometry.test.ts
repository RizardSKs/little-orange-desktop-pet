import { describe, expect, it } from 'vitest';
import { anchorMatrix, assetToWindow, bodyMatrix, DISPLAY, facing, sceneToWindow, STAGES, transform, windowToAsset, windowToScene, type Point, type Pose } from './geometry';
import { gateFrame, renderAssignments, visualSeed } from './frame';

const close = (a: Point, b: Point) => { expect(a.x).toBeCloseTo(b.x, 9); expect(a.y).toBeCloseTo(b.y, 9); };
describe('Phase 1 rig gate', () => {
  it('round trips asset and scene coordinates for every stage and facing', () => {
    for (const stage of STAGES) for (const direction of ['left', 'right'] as const) {
      const matrix = bodyMatrix({ x: 12, y: -18, rotation: 27, scaleX: 1.1, scaleY: .86 }, direction);
      for (const point of [{ x: 0, y: 0 }, { x: 256, y: 400 }, { x: 512, y: 512 }]) {
        close(windowToAsset(stage, matrix, assetToWindow(stage, matrix, point)), point);
        close(windowToScene(stage, sceneToWindow(stage, point)), point);
        close(transform(facing(direction), transform(facing(direction), point)), point);
      }
    }
  });
  it('applies stage scale once and makes scene targets reachable in asset coordinates', () => {
    for (const stage of STAGES) {
      expect(sceneToWindow(stage, { x: 512, y: 0 }).x - sceneToWindow(stage, { x: 0, y: 0 }).x).toBeCloseTo(DISPLAY[stage].size);
      for (const direction of ['left', 'right'] as const) {
        const body = bodyMatrix({ x: 8, y: -4, rotation: 12, scaleX: .95, scaleY: 1.04 }, direction);
        const key = { x: 240, y: 430 };
        const hand = windowToAsset(stage, body, sceneToWindow(stage, key));
        close(assetToWindow(stage, body, hand), sceneToWindow(stage, key));
      }
    }
  });
  it('keeps rigid graphics orthogonal and unit sized while their anchors follow squash', () => {
    for (const rotation of [-30, 0, 30]) for (const scaleX of [.85, 1, 1.15]) for (const scaleY of [.85, 1, 1.15]) for (const direction of ['left', 'right'] as const) {
      const pose: Pose = { x: 10, y: -20, rotation, scaleX, scaleY };
      const anchor = { x: 175, y: 220 };
      const matrix = anchorMatrix(pose, direction, anchor, 'rigid-anchor', 17);
      close(transform(matrix, { x: 0, y: 0 }), transform(bodyMatrix(pose, direction), anchor));
      expect(Math.hypot(matrix[0], matrix[1])).toBeCloseTo(1, 12);
      expect(Math.hypot(matrix[2], matrix[3])).toBeCloseTo(1, 12);
      expect(matrix[0]*matrix[2]+matrix[1]*matrix[3]).toBeCloseTo(0, 12);
      const undeformed = anchorMatrix({ ...pose, scaleX: 1, scaleY: 1 }, direction, anchor, 'rigid-anchor', 17);
      expect(matrix.slice(0, 4)).toEqual(undeformed.slice(0, 4));
    }
  });
  it('assigns one owner across a layer boundary and rejects duplicates', () => {
    for (const time of [499.999, 500, 500.001]) {
      const frame = gateFrame(time, 'right', 1);
      expect(new Set(frame.map(({ id }) => id)).size).toBe(frame.length);
      expect(frame.filter(({ id }) => id === 'hand')).toHaveLength(1);
      expect(frame.find(({ id }) => id === 'hand')?.slot).toBe(time < 500 ? 'frontArm' : 'handFront');
    }
    const frame = gateFrame(500, 'right', 1);
    expect(() => renderAssignments([...frame, frame[0]])).toThrow('Duplicate drawable');
  });
  it('produces the same normal-play, direct-seek, and seeded free visual frames', () => {
    const seed = visualSeed('gate:sequence-42');
    const direct = gateFrame(650, 'left', seed);
    for (let repetition = 0; repetition < 100; repetition++) {
      for (let time = 0; time < 650; time += 1000/60) gateFrame(time, 'left', seed);
      expect(gateFrame(650, 'left', seed)).toEqual(direct);
    }
    expect(gateFrame(650, 'left', seed + 1).filter(({ id }) => id.startsWith('particle'))).not.toEqual(direct.filter(({ id }) => id.startsWith('particle')));
  });
});
