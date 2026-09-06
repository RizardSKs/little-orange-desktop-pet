import { describe, expect, it } from 'vitest';
import { VisualState } from './visual-state';

describe('atomic visual state', () => {
  it('keeps every old stage field until release, then commits the full latest bundle', () => {
    const state=new VisualState('lively');
    const first=state.request({stage:'lively',outfit:'glasses',travel:null});
    state.resolve(first,{character:true,attachment:true});state.commit(true);
    const next=state.request({stage:'mature',outfit:'crown',travel:null});
    state.resolve(next,{character:true,attachment:true});
    expect(state.commit(false)).toBe(false);
    expect(state.committed).toMatchObject({stage:'lively',outfit:'glasses'});
    state.commit(true);
    expect(state.committed).toMatchObject({stage:'mature',outfit:'crown',fallback:false});
  });
  it('ignores stale successes and hides permanent clothing after failed travel loading', () => {
    const state=new VisualState('sprout');
    const a=state.request({stage:'sprout',outfit:'scarf',travel:null});
    state.resolve(a,{character:true,attachment:true});state.commit(true);
    const stale=state.request({stage:'sprout',outfit:'crown',travel:null});
    const latest=state.request({stage:'sprout',outfit:'scarf',travel:'travel-satchel'});
    expect(state.resolve(stale,{character:true,attachment:true})).toBe(false);
    state.resolve(latest,{character:true,attachment:false});state.commit(true);
    expect(state.committed).toMatchObject({outfit:null,travel:null,degraded:true});
  });
  it('locks fallback across same-stage outfit requests and retries at the next stage', () => {
    const state=new VisualState('lively');state.failCharacter();
    let generation=state.request({stage:'lively',outfit:'bow',travel:null});
    state.resolve(generation,{character:true,attachment:true});state.commit(true);
    expect(state.committed.fallback).toBe(true);
    generation=state.request({stage:'mature',outfit:null,travel:null});
    state.resolve(generation,{character:true,attachment:true});state.commit(true);
    expect(state.committed.fallback).toBe(false);
  });
});
