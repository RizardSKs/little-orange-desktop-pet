import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSave } from '../shared/game';
import type { SaveDataV1 } from '../shared/types';
import { SaveStore } from './store';

const directories: string[] = [];
const tempDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orange-pet-test-'));
  directories.push(directory);
  return directory;
};

const legacySave = (): SaveDataV1 => ({
  schemaVersion: 1,
  pet: {
    name: '旧版橙子',
    behavior: 'idle',
    stats: { satiety: 100, mood: 91, energy: 83, cleanliness: 76 },
    lastUpdatedAt: 10_000,
  },
  growth: { level: 19, experience: 500, stage: 'sprout', totalOnlineMs: 999_000, rewardRemainderMs: 42_000 },
  economy: { coins: 8_765, ownedItems: ['leaf-clip', 'crown'], equippedItem: 'crown' },
  settings: {
    autoWalk: false,
    alwaysOnTop: false,
    launchAtLogin: true,
    animationIntensity: 'lively',
    petPosition: { x: -300, y: 120 },
  },
});

const writeJson = (filePath: string, value: unknown) => fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
const readJson = (filePath: string) => JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('SaveStore', () => {
  it('creates a deeply valid schema 2 save on first launch', () => {
    const directory = tempDirectory();
    const state = new SaveStore(directory).load(1_000);
    expect(state.schemaVersion).toBe(2);
    expect(state.pet.name).toBe('小橙子');
    expect(state.economy.inventory).toEqual({});
    expect(state.settings).toMatchObject({
      desktopLocked: false,
      mouseInteractionsEnabled: true,
      keyboardInteractionEnabled: false,
      keyboardConsentVersion: 0,
      walkActivity: 'quiet',
    });
    expect(fs.existsSync(path.join(directory, 'save.json'))).toBe(true);
  });

  it('adds the quiet walk default to an older schema 2 save without changing its schema', () => {
    const directory = tempDirectory();
    const oldSave = createDefaultSave(1_000) as unknown as { settings: Record<string, unknown> };
    delete oldSave.settings.walkActivity;
    writeJson(path.join(directory, 'save.json'), oldSave);

    const loaded = new SaveStore(directory).load(1_000);
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.settings.walkActivity).toBe('quiet');
    expect((readJson(path.join(directory, 'save.json')).settings as Record<string, unknown>).walkActivity).toBe('quiet');
  });

  it('returns an offline summary containing only elapsed time and stat changes', () => {
    const directory = tempDirectory();
    const store = new SaveStore(directory);
    const initial = createDefaultSave(1_000);
    initial.economy.coins = 321;
    initial.growth.experience = 12;
    store.save(initial);

    const loaded = store.loadWithSummary(61_000);
    expect(loaded.offlineSummary).toEqual({
      elapsedMs: 60_000,
      beforeStats: initial.pet.stats,
      afterStats: loaded.state.pet.stats,
    });
    expect(loaded.state.economy.coins).toBe(321);
    expect(loaded.state.growth.experience).toBe(12);
  });

  it('uses a valid backup without replacing it with the corrupt primary', () => {
    const directory = tempDirectory();
    const store = new SaveStore(directory);
    const first = createDefaultSave(1_000);
    first.pet.name = '备份橙子';
    store.save(first);
    const second = structuredClone(first);
    second.pet.name = '新橙子';
    store.save(second);
    fs.writeFileSync(path.join(directory, 'save.json'), '{broken', 'utf8');

    expect(store.load(1_000).pet.name).toBe('备份橙子');
    expect((readJson(path.join(directory, 'save.backup.json')).pet as Record<string, unknown>).name).toBe('备份橙子');
  });

  it('migrates a valid schema 1 backup without overwriting it with a corrupt primary', () => {
    const directory = tempDirectory();
    const savePath = path.join(directory, 'save.json');
    const backupPath = path.join(directory, 'save.backup.json');
    fs.writeFileSync(savePath, '{broken-primary', 'utf8');
    writeJson(backupPath, legacySave());
    const originalBackup = fs.readFileSync(backupPath, 'utf8');

    const migrated = new SaveStore(directory).load(10_000);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.growth.experience).toBe(1_500);
    expect(fs.readFileSync(backupPath, 'utf8')).toBe(originalBackup);
    expect(readJson(path.join(directory, 'save.schema1.backup.json')).schemaVersion).toBe(1);
    expect(readJson(savePath).schemaVersion).toBe(2);
  });

  it('migrates schema 1 atomically, triples current-level experience, and preserves a one-time legacy backup', () => {
    const directory = tempDirectory();
    const source = legacySave();
    const savePath = path.join(directory, 'save.json');
    const migrationBackupPath = path.join(directory, 'save.schema1.backup.json');
    writeJson(savePath, source);

    const store = new SaveStore(directory);
    const migrated = store.load(10_000);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.growth).toEqual({ level: 19, experience: 1_500, stage: 'mature', totalOnlineMs: 999_000, rewardRemainderMs: 42_000 });
    expect(migrated.economy).toMatchObject({ coins: 8_765, ownedItems: ['leaf-clip', 'crown'], equippedItem: 'crown', inventory: {} });
    expect(migrated.settings).toMatchObject({
      autoWalk: false,
      petPosition: { x: -300, y: 120 },
      desktopLocked: false,
      keyboardInteractionEnabled: false,
    });
    expect(readJson(migrationBackupPath).schemaVersion).toBe(1);
    expect(readJson(savePath).schemaVersion).toBe(2);

    const originalBackup = fs.readFileSync(migrationBackupPath, 'utf8');
    store.load(10_000);
    expect(fs.readFileSync(migrationBackupPath, 'utf8')).toBe(originalBackup);
  });

  it('keeps a level 20 legacy save at level 20 and opens progression beyond it', () => {
    const directory = tempDirectory();
    const source = legacySave();
    source.growth = { ...source.growth, level: 20, experience: 0, stage: 'radiant' };
    writeJson(path.join(directory, 'save.json'), source);
    const migrated = new SaveStore(directory).load(10_000);
    expect(migrated.growth).toMatchObject({ level: 20, experience: 0, stage: 'radiant' });
  });

  it('preserves a large safe balance and every stable outfit through migration', () => {
    const directory = tempDirectory();
    const source = legacySave();
    source.economy = {
      coins: 9_000_000_000,
      ownedItems: ['leaf-clip', 'bow', 'glasses', 'top-hat', 'headphones', 'scarf', 'crown', 'halo'],
      equippedItem: 'halo',
    };
    writeJson(path.join(directory, 'save.json'), source);

    const migrated = new SaveStore(directory).load(10_000);
    expect(migrated.economy.coins).toBe(9_000_000_000);
    expect(migrated.economy.ownedItems).toEqual(source.economy.ownedItems);
    expect(migrated.economy.equippedItem).toBe('halo');
  });

  it('does not overwrite files when neither the primary nor backup is valid', () => {
    const directory = tempDirectory();
    const savePath = path.join(directory, 'save.json');
    const backupPath = path.join(directory, 'save.backup.json');
    fs.writeFileSync(savePath, '{broken-primary', 'utf8');
    fs.writeFileSync(backupPath, '{broken-backup', 'utf8');

    const beforePrimary = fs.readFileSync(savePath, 'utf8');
    const beforeBackup = fs.readFileSync(backupPath, 'utf8');
    expect(() => new SaveStore(directory).load(1_000)).toThrow('存档及备份均无效');
    expect(fs.readFileSync(savePath, 'utf8')).toBe(beforePrimary);
    expect(fs.readFileSync(backupPath, 'utf8')).toBe(beforeBackup);
  });

  it('never rolls a future schema back over a valid older backup', () => {
    const directory = tempDirectory();
    const savePath = path.join(directory, 'save.json');
    const backupPath = path.join(directory, 'save.backup.json');
    writeJson(savePath, { schemaVersion: 3, future: { preserved: true } });
    writeJson(backupPath, createDefaultSave(1_000));
    const before = fs.readFileSync(savePath, 'utf8');

    expect(() => new SaveStore(directory).load(1_000)).toThrow('高于当前支持');
    expect(fs.readFileSync(savePath, 'utf8')).toBe(before);
    expect(readJson(savePath).schemaVersion).toBe(3);
  });

  it('stops migration when an existing one-time legacy backup is invalid', () => {
    const directory = tempDirectory();
    const savePath = path.join(directory, 'save.json');
    writeJson(savePath, legacySave());
    fs.writeFileSync(path.join(directory, 'save.schema1.backup.json'), '{broken', 'utf8');
    const original = fs.readFileSync(savePath, 'utf8');

    expect(() => new SaveStore(directory).load(10_000)).toThrow('迁移备份无效');
    expect(fs.readFileSync(savePath, 'utf8')).toBe(original);
    expect(readJson(savePath).schemaVersion).toBe(1);
  });

  it('rejects an invalid schema 2 state before touching the current save', () => {
    const directory = tempDirectory();
    const store = new SaveStore(directory);
    const valid = createDefaultSave(1_000);
    store.save(valid);
    const before = fs.readFileSync(path.join(directory, 'save.json'), 'utf8');
    valid.economy.coins = Number.NaN;

    expect(() => store.save(valid)).toThrow('拒绝保存无效');
    expect(fs.readFileSync(path.join(directory, 'save.json'), 'utf8')).toBe(before);
  });
});
