import { petFrame } from '../src/renderer/rig/pet-frame';
import { CARE_DURATION_MS } from '../src/shared/care';
import { DISPLAY, STAGES } from '../src/renderer/rig/geometry';
import type { CareVisual, GrowthStage, PetDirection, AnimationIntensity } from '../src/shared/types';
import { OUTFIT_IDS } from '../src/renderer/outfit-layout';
import type { OutfitId } from '../src/renderer/outfit-layout';

declare global { interface Window { careAssets: Record<string, string> } }
const images = new Map<string, HTMLImageElement>();
const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
const labels: Record<CareVisual, string> = { feed: '喂食', play: '玩耍', clean: '清洁', 'sleep-in': '入睡', 'sleep-loop': '持续睡眠', wake: '叫醒' };
for (const [action, label] of Object.entries(labels)) select('action').add(new Option(label, action));
for (const stage of STAGES) select('stage').add(new Option({ sprout: '萌芽', lively: '活力', mature: '成熟', radiant: '闪耀' }[stage], stage));
for (const outfit of OUTFIT_IDS) select('outfit').add(new Option(outfit, outfit));
select('stage').value = 'lively';
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const seek = document.getElementById('seek') as HTMLInputElement;
const reduced = document.getElementById('reduced') as HTMLInputElement;
let time = 0, playing = true, last = performance.now();
const play = document.getElementById('play')!;
play.onclick = () => { playing = !playing; };
document.getElementById('restart')!.onclick = () => { time = 0; playing = true; };
document.querySelectorAll('select').forEach(node => node.onchange = () => { time = 0; playing = true; });
seek.oninput = () => { time = Number(seek.value); playing = false; };
async function start() {
  await Promise.all(Object.entries(window.careAssets).map(async ([key, src]) => { const image = new Image(); image.src = src; await image.decode(); images.set(key, image); }));
  function tick(now: number) {
    const careAction = select('action').value as CareVisual;
    const duration = CARE_DURATION_MS[careAction] ?? 36000;
    if (playing) { time = Math.min(duration, time + now - last); if (time >= duration) playing = false; }
    last = now;
    const stage = select('stage').value as GrowthStage;
    const frame = petFrame({ stage, direction: select('direction').value as PetDirection, intensity: select('intensity').value as AnimationIntensity,
      reduced: reduced.checked, kind: 'care', careAction, careVariant: Number(select('variant').value), sequenceId: 1,
      itemId: null, moving: false, timeMs: time, durationMs: CARE_DURATION_MS[careAction] }, select('outfit').value as OutfitId || null, 'neutral', '/assets');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 440, 440);
    for (const part of frame.drawables) {
      const d = DISPLAY[stage];
      ctx.save(); ctx.setTransform(2 * d.size / 512, 0, 0, 2 * d.size / 512, 2 * d.x, 2 * d.y);
      ctx.transform(...part.matrix); ctx.globalAlpha = part.opacity ?? 1;
      if (part.src) ctx.drawImage(images.get(part.src)!, 0, 0, part.width, part.height);
      else { ctx.fillStyle = part.color!; ctx.fillRect(0, 0, part.width, part.height); }
      ctx.restore();
    }
    seek.max = String(duration); seek.value = String(time);
    play.textContent = playing ? '暂停' : '播放';
    document.getElementById('time')!.textContent = `${(time / 1000).toFixed(1)} / ${duration / 1000} 秒`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
void start();
