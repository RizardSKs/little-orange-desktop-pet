import { describe, expect, it } from 'vitest';
import { ACTIONS, actionAt, CONTACT_BOUNDARIES, gripMatrix, type ActionInput } from './actions';
import { STAGES, anchorMatrix, transform, REST_POSE } from './geometry';
import type { InventoryItemId } from '../../shared/economy-types';
import { renderAssignments } from './frame';

describe('authored contact timelines', () => {
  it('keeps attached grips exact and assigns every contact part once across all actions', () => {
    for (const stage of STAGES) for (const direction of ['left','right'] as const) for (const id of Object.keys(ACTIONS) as InventoryItemId[]) {
      const spec=ACTIONS[id];
      const times=new Set([0,...CONTACT_BOUNDARIES.flatMap(p=>[p*spec.cycleMs-.001,p*spec.cycleMs,p*spec.cycleMs+.001]),spec.cycleMs-.001,spec.cycleMs]);
      for(let t=0;t<=spec.cycleMs;t+=1000/60)times.add(t);
      for(const timeMs of times) {
        const input:ActionInput={stage,direction,itemId:id,kind:'inventory-use',timeMs,sequenceId:1,intensity:'lively',reduced:false,moving:false};
        const frame=actionAt(input);
        renderAssignments(frame.extras);
        for(const pair of frame.grips) expect(Math.hypot(pair.hand.x-pair.prop.x,pair.hand.y-pair.prop.y)).toBeLessThan(1e-6);
        expect(actionAt(input)).toEqual(frame);
      }
    }
  });
  it('binds a rigid prop by its graphic grip without changing its shape', () => {
    for(const direction of ['left','right'] as const) {
      const hand=anchorMatrix({...REST_POSE,rotation:30,scaleX:1.15,scaleY:.85},direction,{x:180,y:330},'rigid-anchor',20);
      const grip={x:412,y:300};
      const prop=gripMatrix(hand,grip,200);
      const expected=transform(hand,{x:0,y:0});
      const actual=transform(prop,grip);
      expect(Math.hypot(actual.x-expected.x,actual.y-expected.y)).toBeLessThan(1e-6);
      expect(Math.hypot(prop[0],prop[1])).toBeCloseTo(200/512,12);
    }
  });
  it('retains contact in reduced motion and provides release safe points in every cycle', () => {
    for(const itemId of Object.keys(ACTIONS) as InventoryItemId[]) {
      const base:ActionInput={stage:'lively',direction:'left',itemId,kind:'inventory-use',timeMs:ACTIONS[itemId].cycleMs*.5,sequenceId:2,intensity:'normal',reduced:true,moving:false};
      const frame=actionAt(base);
      expect(frame.phase).toBe('attached');
      for(const pair of frame.grips)expect(pair.hand).toEqual(pair.prop);
      expect(actionAt({...base,timeMs:ACTIONS[itemId].cycleMs*.9}).safe).toBe(true);
    }
  });
});
