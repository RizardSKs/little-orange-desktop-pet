import { describe, expect, it } from 'vitest';
import { armMatrix, characterFrame, SHOULDERS } from './character';
import { REST_POSE, STAGES, transform } from './geometry';

describe('verified shoulder geometry', () => {
  it('keeps both shoulder pivots fixed over the entire verified envelope', () => {
    for (const stage of STAGES) for (const side of ['left', 'right'] as const) {
      const spec = SHOULDERS[stage][side];
      for (let angle = spec.minAngle; angle <= spec.maxAngle; angle++) {
        const actual = transform(armMatrix(stage, side, angle), spec.shoulder);
        expect(actual.x).toBeCloseTo(spec.shoulder.x, 9);
        expect(actual.y).toBeCloseTo(spec.shoulder.y, 9);
      }
      expect(() => armMatrix(stage, side, spec.maxAngle + 1)).toThrow('envelope');
    }
  });
  it('atomically replaces all rig layers with a whole sprite on failure', () => {
    const pose = { body: REST_POSE, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    for (const stage of STAGES) {
      expect(characterFrame(stage, 'left', 'happy', pose, '/assets/pet')).toHaveLength(6);
      const fallback = characterFrame(stage, 'left', 'happy', pose, '/assets/pet', true);
      expect(fallback.map(({ id }) => id)).toEqual(['fallback']);
      expect(fallback[0].src).toBe(`/assets/pet/${stage}.png`);
    }
  });
});
