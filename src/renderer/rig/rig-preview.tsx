import { useState } from 'react';
import type { GrowthStage, PetDirection } from '../../shared/types';
import { STAGES } from './geometry';
import { gateFrame, visualSeed } from './frame';
import { RigRenderer } from './rig-renderer';
import { characterFrame } from './character';
import { REST_POSE } from './geometry';

export function RigPreview() {
  const query = new URLSearchParams(location.search);
  const initialStage = query.get('stage');
  const [time, setTime] = useState(Number(query.get('time') ?? 650));
  const [stage, setStage] = useState<GrowthStage>(STAGES.includes(initialStage as GrowthStage) ? initialStage as GrowthStage : 'lively');
  const [direction, setDirection] = useState<PetDirection>(query.get('direction') === 'left' ? 'left' : 'right');
  return <main style={{ background: '#f4f0e9', height: '100vh', overflow: 'auto', padding: 24 }}>
    <h1>角色绘制验证 · Phase 1</h1><p>固定时间直接求帧；所有色块共用正式绘制组件，不连接存档。</p>
    <label>成长阶段 <select value={stage} onChange={(event) => setStage(event.target.value as GrowthStage)}>{STAGES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label> 朝向 <select value={direction} onChange={(event) => setDirection(event.target.value as PetDirection)}><option>right</option><option>left</option></select></label>
    <p><label>动作时间 {time} ms <input type="range" min="0" max="1800" value={time} onChange={(event) => setTime(Number(event.target.value))} /></label></p>
    <div data-preview-viewport style={{ position: 'relative', width: 220, height: 220, background: '#fff', outline: '1px solid #bda98b' }}><RigRenderer stage={stage} drawables={query.get('fixture') === 'character' ? characterFrame(stage, direction, 'neutral', { body: REST_POSE, leftArm: Number(query.get('angle') ?? 0), rightArm: -Number(query.get('angle') ?? 0), leftLeg: 0, rightLeg: 0 }, '/assets/pet') : gateFrame(time, direction, visualSeed('gate:1'))} /></div>
  </main>;
}
