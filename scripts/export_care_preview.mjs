// Bundle the production evaluator into one offline review artifact; no save bridge or network.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
const result = await build({ configFile: false, logLevel: 'error', build: { write: false, minify: true, lib: { entry: path.resolve('scripts/care_preview_entry.ts'), name: 'CarePreview', formats: ['iife'] } } });
const bundle = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code;
const assets = {};
for (const directory of ['assets/pet', 'assets/outfits', 'assets/props/rig']) {
  for (const file of fs.readdirSync(directory, { recursive: true }).filter(file => file.endsWith('.png'))) {
    const key = path.join(directory, file).replaceAll('\\', '/');
    assets['/' + key] = 'data:image/png;base64,' + fs.readFileSync(key).toString('base64');
  }
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>小橙子 · 四项互动动作</title>
<style>body{max-width:760px;margin:40px auto;padding:0 24px;background:#faf4e9;color:#443125;font:16px/1.7 system-ui}h1{font-size:28px}select,button{font:inherit;padding:7px 12px;border:1px solid #d7b994;border-radius:9px;background:white;margin:4px}canvas{width:220px;height:220px;background:white;border-radius:16px;border:1px solid #ead8bf}#seek{width:100%}small{color:#786654}.controls{margin:16px 0}</style>
<h1>小橙子 · 四项互动动作</h1><p>观察准备、接触、使用、反应与收尾。切换成长阶段和动作变化，看小橙子的不同表现。</p>
<div class="controls"><select id="action" aria-label="动作"></select><select id="stage" aria-label="成长阶段"></select><select id="variant" aria-label="动作变化"><option value="0">变化一</option><option value="1">变化二</option><option value="2">变化三</option></select><select id="direction" aria-label="朝向"><option value="right">朝右</option><option value="left">朝左</option></select><select id="intensity" aria-label="强度"><option value="normal">标准</option><option value="gentle">轻柔</option><option value="lively">活泼</option></select><select id="outfit" aria-label="装扮"><option value="">无装扮</option></select></div>
<canvas width="440" height="440" aria-label="动作预览"></canvas><p><button id="play">暂停</button><button id="restart">重播</button><label><input id="reduced" type="checkbox">减少动态</label><span id="time"></span></p><input id="seek" type="range" min="0" value="0" aria-label="播放位置">
<small>离线预览，无存档访问。使用正式动作计算逻辑，画面显示为桌宠原尺寸。此预览不替代安装版、真实多屏或 Windows DPI 验收。</small>
<script>window.careAssets=${JSON.stringify(assets)};</script><script>${bundle.replaceAll('</script', '<\\/script')}</script></html>`;
const output = path.resolve('tmp/rig-evidence/care/小橙子四项互动预览.html');
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, html);
console.log(output);
