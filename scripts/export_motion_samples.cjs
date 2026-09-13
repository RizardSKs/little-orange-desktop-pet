// Offline comparison from the production frame evaluator. Captured frame playback, not LivePet.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
(async()=>{
  const {createServer}=await import('vite');
  const server=await createServer({configFile:false,server:{middlewareMode:true,watch:null}});
  try {
    const current=await server.ssrLoadModule('/src/renderer/rig/pet-frame.ts');
    const previous=await server.ssrLoadModule('/tmp/motion-baseline/src/renderer/rig/pet-frame.ts');
    const {SAMPLE_IDS}=await server.ssrLoadModule('/src/renderer/rig/sample-actions.ts');
    const {findInventoryItem}=await server.ssrLoadModule('/src/shared/catalog.ts');
    const {DISPLAY}=await server.ssrLoadModule('/src/renderer/rig/geometry.ts');
    const assets=[],assetIds=new Map(),clips=[],metrics=[];
    const fps=24;
    for(const itemId of SAMPLE_IDS) {
      const item=findInventoryItem(itemId),duration=item.useVisual.durationMs;
      const clip={name:item.name,duration,frames:[],before:[]};
      for(const [name,module] of [['before',previous],['frames',current]]) {
        let sum=0,max=0,parts=0;
        for(let frameIndex=0;frameIndex<=Math.ceil(duration*fps/1000);frameIndex++) {
          const timeMs=Math.min(duration,frameIndex*1000/fps),ended=timeMs>=duration;
          const start=performance.now();
          const frame=module.petFrame({stage:'lively',direction:'right',intensity:'normal',reduced:false,kind:ended?'idle':'inventory-use',itemId:ended?null:itemId,sequenceId:1,timeMs:ended?0:timeMs,durationMs:duration,moving:false},null,ended?'neutral':item.useVisual.expression,'/assets');
          const cost=performance.now()-start;sum+=cost;max=Math.max(max,cost);parts=Math.max(parts,frame.drawables.length);
          clip[name].push(frame.drawables.map(part=>{
            if(!part.src)throw Error('Unexpected non-image sample drawable');
            if(!assetIds.has(part.src)) {
              assetIds.set(part.src,assets.length);
              assets.push('data:image/png;base64,'+fs.readFileSync(part.src.slice(1)).toString('base64'));
            }
            return [assetIds.get(part.src),...part.matrix.map(value=>Math.round(value*10000)/10000),part.opacity??1];
          }));
        }
        metrics.push({itemId,version:name,frames:clip[name].length,meanEvaluationMs:sum/clip[name].length,maxEvaluationMs:max,maxDrawables:parts});
      }
      clips.push(clip);
    }
    const data=JSON.stringify({assets,clips,fps,display:DISPLAY.lively});
    const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>小橙子动作样板对比</title>
<style>body{font:16px system-ui;background:#faf5ed;color:#392d22;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:26px}button,select{font:inherit;padding:8px 14px;margin:4px;border:1px solid #d8b992;border-radius:8px;background:white}section{display:flex;gap:28px;flex-wrap:wrap}canvas{width:220px;height:220px;background:white;border:1px solid #dcc8ae;border-radius:12px}input{width:100%;accent-color:#e59637}p{line-height:1.7}.note{color:#7a6959;font-size:14px}</style>
<h1>小橙子 · 四项动作样板</h1><p>先观察动作是否像在使用道具，再观察拿起、停顿与收尾是否自然。</p>
<select id="action"></select><button id="play">播放</button><button id="restart">重新播放</button>
<section><div><h3>开发前</h3><canvas id="before" width="440" height="440"></canvas></div><div><h3>本次样板</h3><canvas id="after" width="440" height="440"></canvas></div></section>
<p id="time"></p><input id="seek" type="range" min="0" value="0"><p class="note">离线预览 · 活泼阶段 / 朝右 · 原尺寸 220 × 220 · 24 帧/秒。画面来自正式动作求帧函数的采样；不连接存档。此页面不等同于安装版运行与性能验收。四阶段、双朝向及减少动态可在项目开发预览中检查。</p>
<script>const data=${data};
const images=data.assets.map(src=>{const i=new Image();i.src=src;return i;});
const select=document.getElementById('action'),seek=document.getElementById('seek'),play=document.getElementById('play');
data.clips.forEach((c,i)=>select.add(new Option(c.name,i)));
let time=0,playing=false,last=performance.now();
function draw(id,frames){const canvas=document.getElementById(id),ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,440,440);const frame=frames[Math.min(frames.length-1,Math.floor(time/1000*data.fps))];for(const p of frame){ctx.save();const d=data.display;ctx.setTransform(2*d.size/512,0,0,2*d.size/512,2*d.x,2*d.y);ctx.transform(...p.slice(1,7));ctx.globalAlpha=p[7];ctx.drawImage(images[p[0]],0,0,512,512);ctx.restore();}}
function tick(now){const c=data.clips[select.value];if(playing){time=Math.min(c.duration,time+now-last);if(time>=c.duration)playing=false;}last=now;seek.max=c.duration;seek.value=time;play.textContent=playing?'暂停':'播放';document.getElementById('time').textContent=(time/1000).toFixed(1)+' / '+c.duration/1000+' 秒';draw('before',c.before);draw('after',c.frames);requestAnimationFrame(tick);}
select.onchange=()=>{time=0;playing=true;};seek.oninput=()=>{time=+seek.value;playing=false;};play.onclick=()=>{if(time>=data.clips[select.value].duration)time=0;playing=!playing;};document.getElementById('restart').onclick=()=>{time=0;playing=true;};Promise.all(images.map(i=>i.decode())).then(()=>requestAnimationFrame(tick));
</script></html>`;
    const output=path.resolve('tmp/rig-evidence/motion-samples');fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'小橙子动作样板对比.html'),html);
    fs.writeFileSync(path.join(output,'evaluation-metrics.json'),JSON.stringify({note:'Frame evaluator CPU wall time only; not renderer FPS, process CPU, or memory. Cold JIT samples included.',metrics},null,2));
    console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),clips:clips.length}));
  } finally {await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
