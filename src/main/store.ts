import fs from 'node:fs';
import path from 'node:path';
import {
  createDefaultSave,
  migrateSaveV1ToV2,
  settleOffline,
  validateLegacySave,
  validateSave,
} from '../shared/game';
import type { OfflineSummary, SaveData, SaveDataV1 } from '../shared/types';

interface SaveCandidate {
  state: SaveData;
  sourcePath: string;
  migratedFrom: SaveDataV1 | null;
}

export class SaveStore {
  private readonly savePath: string;
  private readonly backupPath: string;
  private readonly legacyBackupPath: string;
  private readonly tempPath: string;

  constructor(private readonly directory: string) {
    this.savePath = path.join(directory, 'save.json');
    this.backupPath = path.join(directory, 'save.backup.json');
    this.legacyBackupPath = path.join(directory, 'save.schema1.backup.json');
    this.tempPath = path.join(directory, 'save.tmp.json');
  }

  load(now = Date.now()): SaveData {
    return this.loadWithSummary(now).state;
  }

  loadWithSummary(now = Date.now()): { state: SaveData; offlineSummary: OfflineSummary } {
    fs.mkdirSync(this.directory, { recursive: true });
    const hasPrimary = fs.existsSync(this.savePath);
    const hasBackup = fs.existsSync(this.backupPath);
    const primarySchema = this.readSchemaVersion(this.savePath);
    if (primarySchema !== null && primarySchema > 2) {
      throw new Error(`存档 schema ${primarySchema} 高于当前支持的 schema 2；已保留原文件。`);
    }
    const candidate = this.readCandidate(this.savePath) ?? this.readCandidate(this.backupPath);
    if (!candidate && (hasPrimary || hasBackup)) {
      throw new Error('存档及备份均无效；已保留原文件，未创建默认档。');
    }

    let loaded = candidate?.state ?? createDefaultSave(now);
    if (candidate?.migratedFrom) this.ensureLegacyBackup(candidate.sourcePath);
    const settled = settleOffline(loaded, now);
    loaded = settled.state;
    this.writeValidated(loaded, candidate?.sourcePath === this.savePath);
    return { state: loaded, offlineSummary: settled.summary };
  }

  save(state: SaveData): void {
    fs.mkdirSync(this.directory, { recursive: true });
    this.writeValidated(state, true);
  }

  private writeValidated(state: SaveData, backupCurrent: boolean): void {
    if (!validateSave(state)) throw new Error('拒绝保存无效的 schema 2 状态。');
    const serialized = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.tempPath, serialized, 'utf8');
    const verified = this.readJson(this.tempPath);
    if (!validateSave(verified)) throw new Error('临时存档写入校验失败。');
    if (backupCurrent && fs.existsSync(this.savePath)) fs.copyFileSync(this.savePath, this.backupPath);
    fs.renameSync(this.tempPath, this.savePath);
  }

  private ensureLegacyBackup(sourcePath: string): void {
    if (fs.existsSync(this.legacyBackupPath)) {
      if (!validateLegacySave(this.readJson(this.legacyBackupPath))) {
        throw new Error('既有 schema 1 迁移备份无效；已停止迁移且未覆盖该文件。');
      }
      return;
    }
    fs.copyFileSync(sourcePath, this.legacyBackupPath, fs.constants.COPYFILE_EXCL);
    if (!validateLegacySave(this.readJson(this.legacyBackupPath))) {
      throw new Error('schema 1 迁移备份校验失败；已停止迁移。');
    }
  }

  private readCandidate(filePath: string): SaveCandidate | null {
    const parsed = this.readJson(filePath);
    if (validateSave(parsed)) return { state: parsed, sourcePath: filePath, migratedFrom: null };
    if (validateLegacySave(parsed)) {
      return { state: migrateSaveV1ToV2(parsed), sourcePath: filePath, migratedFrom: parsed };
    }
    return null;
  }

  private readJson(filePath: string): unknown {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    } catch {
      return null;
    }
  }

  private readSchemaVersion(filePath: string): number | null {
    const value = this.readJson(filePath);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const schemaVersion = (value as Record<string, unknown>).schemaVersion;
    return Number.isSafeInteger(schemaVersion) ? schemaVersion as number : null;
  }
}
