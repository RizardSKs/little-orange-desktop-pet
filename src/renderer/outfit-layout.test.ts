import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS } from '../shared/catalog';
import { OUTFIT_IDS, OUTFIT_LAYOUTS } from './outfit-layout';

describe('local outfit assets and stage layouts', () => {
  it('keeps all stable ids mapped to 512px RGBA PNG assets', () => {
    expect(SHOP_ITEMS.map(({ id }) => id)).toEqual(OUTFIT_IDS);
    for (const item of SHOP_ITEMS) {
      expect(item.assetFile).toBe(`${item.id}.png`);
      const png = fs.readFileSync(path.join(process.cwd(), 'assets', 'outfits', item.assetFile));
      expect(png.readUInt32BE(16)).toBe(512);
      expect(png.readUInt32BE(20)).toBe(512);
      expect(png[25]).toBe(6);
    }
  });

  it('defines bounded placement for all 32 stage and outfit combinations', () => {
    for (const stage of ['sprout', 'lively', 'mature', 'radiant'] as const) {
      expect(Object.keys(OUTFIT_LAYOUTS[stage])).toEqual(OUTFIT_IDS);
      for (const layout of Object.values(OUTFIT_LAYOUTS[stage])) {
        expect(layout.x).toBeGreaterThanOrEqual(-10);
        expect(layout.y).toBeGreaterThanOrEqual(-10);
        expect(layout.width).toBeGreaterThanOrEqual(30);
        expect(layout.x + layout.width).toBeLessThanOrEqual(170);
        expect(layout.y + layout.width).toBeLessThanOrEqual(180);
        expect(Math.abs(layout.rotation)).toBeLessThanOrEqual(25);
      }
    }
  });
});
