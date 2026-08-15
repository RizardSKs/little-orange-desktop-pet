import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSave } from '../shared/game';
import { SaveStore } from './store';

const directories: string[] = [];
const tempDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orange-pet-test-'));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('SaveStore', () => {
  it('creates a default save on first launch', () => {
    const directory = tempDirectory();
    const state = new SaveStore(directory).load(1000);
    expect(state.pet.name).toBe('小橙子');
    expect(fs.existsSync(path.join(directory, 'save.json'))).toBe(true);
  });

  it('uses the backup when the primary save is corrupt', () => {
    const directory = tempDirectory();
    const store = new SaveStore(directory);
    const first = createDefaultSave(1000);
    first.pet.name = '备份橙子';
    store.save(first);
    const second = structuredClone(first);
    second.pet.name = '新橙子';
    store.save(second);
    fs.writeFileSync(path.join(directory, 'save.json'), '{broken', 'utf8');
    expect(store.load(1000).pet.name).toBe('备份橙子');
  });
});
