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

  it('renders the five aligned character layers with a whole-sprite fallback', () => {
    const component = read('src/renderer/App.tsx');
    for (const layer of ['body.png', 'arm-left.png', 'arm-right.png', 'leg-left.png', 'leg-right.png']) expect(component).toContain(layer);
    expect(component).toContain('fallbackSprite');
  });

  it('ships 512px RGBA layers for every growth stage', () => {
    for (const stage of ['sprout', 'lively', 'mature', 'radiant']) {
      for (const layer of ['body', 'arm-left', 'arm-right', 'leg-left', 'leg-right']) {
        const image = fs.readFileSync(path.join(process.cwd(), 'assets', 'pet', stage, `${layer}.png`));
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
