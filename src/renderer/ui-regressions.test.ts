import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('desktop pet visual regressions', () => {
  it('keeps the pet document transparent and scopes the panel background', () => {
    const css = read('src/renderer/styles.css');
    expect(css).toContain('body[data-view="pet"] { background:transparent; }');
    expect(css).toContain('body[data-view="panel"] { background:#fff8ee; }');
    expect(css).not.toMatch(/\nbody\s*\{\s*background:\s*#fff8ee/);
  });

  it('renders the aligned character rig, raster expressions, and whole-sprite fallback', () => {
    const component = read('src/renderer/pet-view.tsx');
    for (const layer of ['body.png', 'arm-left.png', 'arm-right.png', 'leg-left.png', 'leg-right.png']) expect(component).toContain(layer);
    expect(component).toContain('/expressions/${expression}.png');
    expect(component).toContain('pet-expression');
    expect(component).not.toContain('className="face"');
    expect(component).toContain('fallbackSprite');
    expect(component).toContain('DRAG_THRESHOLD_DIP');
    expect(component).toContain('requestAnimationFrame');
    expect(component).toContain('dragVisualForMovement');
    expect(component).toContain("runtime.interaction.kind === 'dragging'");
    expect(component).toContain('outfit-layer');
    expect(component).toContain('outfitStyle(state.growth.stage');
    expect(component).toContain('CELEBRATION_PROPS');
    expect(component).toContain('effect-grand-tour-return');
  });

  it('exposes growth, life, exploration, lock, and privacy controls in the panel', () => {
    const panel = read('src/renderer/panel-view.tsx');
    for (const text of ['在线陪伴效率', '用品', '服务', '探索', '背包', '桌面锁定', '键盘陪打']) expect(panel).toContain(text);
    expect(panel).toContain('不会读取、传递或保存按键内容');
    expect(panel).not.toContain('离线收益');
  });

  it('surfaces queued effects and pending expedition rewards on the status tab', () => {
    const panel = read('src/renderer/panel-view.tsx');
    const css = read('src/renderer/styles.css');
    for (const text of ['限时体验队列', '当前剩余', '排队', '总剩余', '返程故事待确认', '前往探索查看']) {
      expect(panel).toContain(text);
    }
    expect(panel).toContain('queuedSegments: queue.length - 1');
    expect(panel).toContain("setLifeSection('explore')");
    expect(panel).toContain("setTab('life')");
    expect(css).toContain('.effect-queue-row');
    expect(css).toContain('.pending-return-status');
  });

  it('ships 512px RGBA rig and raster-expression layers for every growth stage', () => {
    const expressions = ['neutral', 'happy', 'curious', 'surprised', 'proud', 'focused', 'delighted', 'excited', 'refreshed', 'asleep', 'sad', 'sleepy', 'hungry', 'uncomfortable'];
    for (const stage of ['sprout', 'lively', 'mature', 'radiant']) {
      const assets = [
        path.join('assets', 'pet', `${stage}.png`),
        ...['body', 'arm-left', 'arm-right', 'leg-left', 'leg-right'].map((layer) => path.join('assets', 'pet', stage, `${layer}.png`)),
        ...expressions.map((expression) => path.join('assets', 'pet', stage, 'expressions', `${expression}.png`)),
      ];
      for (const asset of assets) {
        const image = fs.readFileSync(path.join(process.cwd(), asset));
        expect(image.readUInt32BE(16)).toBe(512);
        expect(image.readUInt32BE(20)).toBe(512);
        expect(image[25]).toBe(6);
      }
    }
  });

  it('installs a Chinese application menu', () => {
    const main = read('src/main/main.ts');
    for (const label of ["label: '文件'", "label: '宠物'", "label: '查看'", "label: '帮助'"]) expect(main).toContain(label);
  });
});
