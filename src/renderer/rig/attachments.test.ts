import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { attachmentDrawables, outfitSpec, OUTFIT_IDS } from './attachments';
import { REST_POSE, STAGES } from './geometry';
import { renderAssignments } from './frame';

describe('permanent attachment recipes', () => {
  it('ships all required layers for every stage and stable id', () => {
    for (const stage of STAGES) for (const id of OUTFIT_IDS) {
      const spec = outfitSpec(stage, id);
      for (const layer of spec.layers) expect(existsSync(`assets/outfits/${layer.file}`)).toBe(true);
      expect(spec.mirrorPolicy).toBe('with-character');
      expect(spec.width).toBeGreaterThan(0);
      expect(renderAssignments(attachmentDrawables(spec, id, REST_POSE, 'left', '/assets/outfits'))).toHaveLength(spec.layers.length);
    }
  });
  it('keeps rigid outfit graphic shape invariant under body squash', () => {
    for (const stage of STAGES) for (const id of OUTFIT_IDS.filter(id => id !== 'scarf')) {
      const spec = outfitSpec(stage,id);
      const rest = attachmentDrawables(spec,id,REST_POSE,'left','')[0].matrix;
      const squash = attachmentDrawables(spec,id,{...REST_POSE,scaleX:1.15,scaleY:.85},'left','')[0].matrix;
      expect(squash.slice(0,4)).toEqual(rest.slice(0,4));
    }
  });
});
