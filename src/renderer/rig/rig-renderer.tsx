import type { GrowthStage } from '../../shared/types';
import { cssMatrix, displayMatrix } from './geometry';
import { renderAssignments, RENDER_SLOTS, type Drawable } from './frame';

export function RigRenderer({ stage, drawables, onAssetError }: { stage: GrowthStage; drawables: readonly Drawable[]; onAssetError?: (id: string) => void }) {
  const frame = renderAssignments(drawables);
  return <div data-rig-stage={stage} style={{ position: 'absolute', width: 512, height: 512, transformOrigin: '0 0', transform: cssMatrix(displayMatrix(stage)), pointerEvents: 'none' }}>
    {frame.map((part) => {
      const style = { position: 'absolute' as const, left: 0, top: 0, width: part.width, height: part.height, transformOrigin: '0 0', transform: cssMatrix(part.matrix), opacity: part.opacity ?? 1, zIndex: RENDER_SLOTS.indexOf(part.slot), background: part.src ? undefined : part.color };
      return part.src
        ? <img key={part.id} data-drawable={part.id} data-slot={part.slot} src={part.src} style={style} alt="" draggable={false} onError={() => onAssetError?.(part.id)} />
        : <div key={part.id} data-drawable={part.id} data-slot={part.slot} style={style} />;
    })}
  </div>;
}
