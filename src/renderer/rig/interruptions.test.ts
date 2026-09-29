import { expect, it } from 'vitest';
import { actionAt, ACTIONS, MAX_INTERRUPTED_PROP_EXIT_MS, type ActionInput } from './actions';
import { exitAt, interruptProps } from './interruptions';
import { renderAssignments } from './frame';

const input:ActionInput={stage:'lively',direction:'right',intensity:'normal',reduced:false,kind:'inventory-use',itemId:'item-citrus-cookie',sequenceId:3,timeMs:1000,moving:false};
it('captures scene geometry on interruption and cleans it at the centralized deadline',()=>{
  const frame=actionAt(input);
  const exit=interruptProps(frame.extras,frame.policy,1000,3,false);
  expect(exitAt(exit,1000)[0].matrix).toEqual(frame.extras.find(part=>part.id==='action-prop')?.matrix);
  expect(exitAt(exit,1100)[0].opacity).toBe(.5);
  expect(exitAt(exit,1000+MAX_INTERRUPTED_PROP_EXIT_MS)).toEqual([]);
  renderAssignments([...actionAt({...input,sequenceId:4,itemId:'item-honey-soda'}).extras,...exitAt(exit,1100)]);
});
it('does not resurrect inactive free targets or effects, and exits immediately in reduced motion',()=>{
  const frame=actionAt(input);
  for(const policy of ['resume-free-motion','hide-immediately'] as const)expect(exitAt(interruptProps(frame.extras,policy,10,3,false),11)).toEqual([]);
  expect(exitAt(interruptProps(frame.extras,frame.policy,10,3,true),10)).toEqual([]);
});
it('preserves exact contact through a reduced-motion weight transition',()=>{
  for(const itemId of ['item-citrus-cookie','item-honey-soda','service-cozy-grooming','service-desktop-picnic'] as const){
    for(const motionWeight of [1,.75,.5,.25,0]){
      const frame=actionAt({...input,itemId,timeMs:ACTIONS[itemId].cycleMs*.5,reduced:true,motionWeight});
      expect(frame.grips.length).toBeGreaterThan(0);
      for(const pair of frame.grips)expect(Math.hypot(pair.hand.x-pair.prop.x,pair.hand.y-pair.prop.y)).toBeLessThan(1e-6);
    }
  }
});
