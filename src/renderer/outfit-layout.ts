import type { CSSProperties } from 'react';
import type { GrowthStage } from '../shared/types';

export const OUTFIT_IDS = ['leaf-clip', 'bow', 'glasses', 'top-hat', 'headphones', 'scarf', 'crown', 'halo'] as const;
export type OutfitId = typeof OUTFIT_IDS[number];

export interface OutfitLayout {
  x: number;
  y: number;
  width: number;
  rotation: number;
}

export const OUTFIT_LAYOUTS: Record<GrowthStage, Record<OutfitId, OutfitLayout>> = {
  sprout: {
    'leaf-clip': { x: 38, y: 22, width: 39, rotation: -18 },
    bow: { x: 105, y: 42, width: 43, rotation: 9 },
    glasses: { x: 43, y: 82, width: 78, rotation: 0 },
    'top-hat': { x: 49, y: 8, width: 69, rotation: -6 },
    headphones: { x: 31, y: 51, width: 104, rotation: 0 },
    scarf: { x: 42, y: 92, width: 82, rotation: 0 },
    crown: { x: 49, y: 12, width: 68, rotation: 0 },
    halo: { x: 35, y: 0, width: 96, rotation: 0 },
  },
  lively: {
    'leaf-clip': { x: 35, y: 25, width: 38, rotation: -20 },
    bow: { x: 107, y: 39, width: 42, rotation: 10 },
    glasses: { x: 45, y: 77, width: 76, rotation: 0 },
    'top-hat': { x: 48, y: 1, width: 71, rotation: -5 },
    headphones: { x: 30, y: 47, width: 105, rotation: 0 },
    scarf: { x: 41, y: 92, width: 84, rotation: 0 },
    crown: { x: 48, y: 7, width: 70, rotation: 0 },
    halo: { x: 34, y: -2, width: 98, rotation: 0 },
  },
  mature: {
    'leaf-clip': { x: 31, y: 34, width: 37, rotation: -23 },
    bow: { x: 109, y: 49, width: 41, rotation: 12 },
    glasses: { x: 47, y: 88, width: 74, rotation: 0 },
    'top-hat': { x: 47, y: 8, width: 73, rotation: -5 },
    headphones: { x: 29, y: 56, width: 108, rotation: 0 },
    scarf: { x: 40, y: 91, width: 86, rotation: 0 },
    crown: { x: 47, y: 13, width: 72, rotation: 0 },
    halo: { x: 32, y: 2, width: 101, rotation: 0 },
  },
  radiant: {
    'leaf-clip': { x: 30, y: 35, width: 36, rotation: -24 },
    bow: { x: 110, y: 50, width: 40, rotation: 12 },
    glasses: { x: 47, y: 91, width: 74, rotation: 0 },
    'top-hat': { x: 46, y: 8, width: 74, rotation: -5 },
    headphones: { x: 28, y: 58, width: 109, rotation: 0 },
    scarf: { x: 39, y: 90, width: 87, rotation: 0 },
    crown: { x: 46, y: 14, width: 73, rotation: 0 },
    halo: { x: 31, y: 1, width: 103, rotation: 0 },
  },
};

export function outfitStyle(stage: GrowthStage, outfitId: OutfitId): CSSProperties {
  const layout = OUTFIT_LAYOUTS[stage][outfitId];
  return {
    left: layout.x,
    top: layout.y,
    width: layout.width,
    transform: `rotate(${layout.rotation}deg)`,
  };
}

export function outfitAssetPath(assetFile: string): string {
  const root = location.protocol === 'file:' ? '../assets/outfits' : '/assets/outfits';
  return `${root}/${assetFile}`;
}
