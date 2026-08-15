import fs from 'node:fs';
import path from 'node:path';
import { createDefaultSave, settleOffline, validateSave } from '../shared/game';
import type { SaveData } from '../shared/types';

export class SaveStore {
  private readonly savePath: string;
  private readonly backupPath: string;
  private readonly tempPath: string;

  constructor(private readonly directory: string) {
    this.savePath = path.join(directory, 'save.json');
    this.backupPath = path.join(directory, 'save.backup.json');
    this.tempPath = path.join(directory, 'save.tmp.json');
  }

  load(now = Date.now()): SaveData {
    fs.mkdirSync(this.directory, { recursive: true });
    const loaded = this.readValid(this.savePath) ?? this.readValid(this.backupPath) ?? createDefaultSave(now);
    const settled = settleOffline(loaded, now).state;
    this.save(settled);
    return settled;
  }

  save(state: SaveData): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const serialized = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.tempPath, serialized, 'utf8');
    if (fs.existsSync(this.savePath)) fs.copyFileSync(this.savePath, this.backupPath);
    fs.renameSync(this.tempPath, this.savePath);
  }

  private readValid(filePath: string): SaveData | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateSave(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
