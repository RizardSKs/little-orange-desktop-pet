import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './game';
import { idleExpressionFromRoll, resolvePetExpression } from './expression';

describe('pet expression resolver', () => {
  it('maps the weighted idle pool deterministically', () => {
    expect([0, 0.4, 0.65, 0.8, 0.9].map(idleExpressionFromRoll)).toEqual(['neutral', 'happy', 'curious', 'surprised', 'proud']);
    expect(idleExpressionFromRoll(-1)).toBe('neutral');
    expect(idleExpressionFromRoll(2)).toBe('proud');
  });

  it('gives behaviors priority over needs and idle expressions', () => {
    const state = createDefaultSave(0);
    state.pet.stats = { satiety: 0, mood: 0, energy: 0, cleanliness: 0 };
    const cases = [
      ['walking', 'focused'], ['eating', 'delighted'], ['playing', 'excited'],
      ['cleaning', 'refreshed'], ['sleeping', 'asleep'], ['sad', 'sad'],
    ] as const;
    for (const [behavior, expression] of cases) {
      state.pet.behavior = behavior;
      expect(resolvePetExpression(state, 0)).toBe(expression);
    }
  });

  it('uses the lowest critical need with a stable tie priority', () => {
    const state = createDefaultSave(0);
    state.pet.stats = { satiety: 10, mood: 15, energy: 5, cleanliness: 12 };
    expect(resolvePetExpression(state)).toBe('sleepy');
    state.pet.stats = { satiety: 5, mood: 15, energy: 10, cleanliness: 12 };
    expect(resolvePetExpression(state)).toBe('hungry');
    state.pet.stats = { satiety: 15, mood: 14, energy: 16, cleanliness: 5 };
    expect(resolvePetExpression(state)).toBe('uncomfortable');
    state.pet.stats = { satiety: 15, mood: 5, energy: 16, cleanliness: 14 };
    expect(resolvePetExpression(state)).toBe('sad');
    state.pet.stats = { satiety: 20, mood: 20, energy: 20, cleanliness: 20 };
    expect(resolvePetExpression(state, 0.4)).toBe('sleepy');
  });
});
