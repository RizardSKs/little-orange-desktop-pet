import { describe, expect, it, vi } from 'vitest';
import { CareController } from './care-controller';
import { createDefaultSave } from '../shared/game';
import type { CareVisual } from '../shared/types';

function harness() {
  let state = createDefaultSave(1000);
  state.pet.stats = { satiety: 0, mood: 0, energy: 90, cleanliness: 0 };
  let active: CareVisual | null = null;
  const events: string[] = [];
  const save = vi.fn(() => { events.push('save'); });
  const present = vi.fn((action: CareVisual) => { events.push('present'); active = action; });
  const controller = new CareController({ state: () => state, busy: action => action === active,
    save, commit: next => { events.push('commit'); state = next; }, present, publish: () => { events.push('publish'); } });
  return { controller, save, present, events, state: () => state };
}

describe('care command transactions', () => {
  it('commits before presentation and deduplicates retries without stale state', () => {
    const h = harness();
    const first = h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(first.ok).toBe(true);
    expect(h.events).toEqual(['save', 'commit', 'present', 'publish']);
    h.controller.execute('panel', 'play', { id: '2' }, 1000);
    const retry = h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(retry.state).toBe(h.state());
    expect(h.state().economy.coins).toBe(25);
    expect(h.present).toHaveBeenCalledTimes(2);
  });
  it('rejects same active care but accepts feed-play-feed as distinct commands', () => {
    const h = harness();
    h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(h.controller.execute('panel', 'feed', { id: '2' }, 1000).code).toBe('busy');
    h.controller.execute('panel', 'play', { id: '3' }, 1000);
    h.controller.execute('panel', 'feed', { id: '4' }, 1000);
    expect(h.state().economy.coins).toBe(20);
    expect(h.state().pet.stats.satiety).toBe(50);
    expect(h.present).toHaveBeenCalledTimes(3);
  });
  it('does not commit or present when saving fails, including retry of the same ID', () => {
    const h = harness(); h.save.mockImplementation(() => { throw Error('disk'); });
    const before = h.state();
    expect(h.controller.execute('panel', 'feed', { id: '1' }, 1000).code).toBe('save-failed');
    h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(h.state()).toBe(before); expect(h.present).not.toHaveBeenCalled(); expect(h.save).toHaveBeenCalledOnce();
  });
  it('never repeats settlement after a committed presentation failure', () => {
    const h = harness(); h.present.mockImplementation(() => { throw Error('window'); });
    expect(h.controller.execute('panel', 'feed', { id: '1' }, 1000).ok).toBe(true);
    h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(h.state().economy.coins).toBe(25); expect(h.save).toHaveBeenCalledOnce();
  });
  it('failed care preserves sleep and target sleep commands do not toggle twice', () => {
    const h = harness();
    h.controller.execute('panel', 'sleep', { id: '1', sleepTarget: 'asleep' }, 1000);
    h.state().economy.coins = 0;
    expect(h.controller.execute('panel', 'feed', { id: '2' }, 1000).ok).toBe(false);
    expect(h.state().pet.behavior).toBe('sleeping');
    expect(h.controller.execute('menu', 'sleep', { id: '3', sleepTarget: 'asleep' }, 1000).code).toBe('unchanged');
    h.controller.execute('menu', 'sleep', { id: '4', sleepTarget: 'awake' }, 1000);
    expect(h.present.mock.calls.map(call => call[0])).toEqual(['sleep-in', 'wake']);
  });
  it('rejects malformed identity and mismatched retry while isolating sources', () => {
    const h = harness();
    expect(() => h.controller.execute('panel', 'feed', { id: '' })).toThrow();
    h.controller.execute('panel', 'feed', { id: '1' }, 1000);
    expect(() => h.controller.execute('panel', 'play', { id: '1' }, 1000)).toThrow();
    expect(h.controller.execute('menu', 'play', { id: '1' }, 1000).ok).toBe(true);
  });
});
