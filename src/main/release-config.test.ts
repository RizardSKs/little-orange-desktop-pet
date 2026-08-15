import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('offline cumulative update release', () => {
  it('keeps the stable application identity and versioned artifacts', () => {
    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.name).toBe('little-orange-desktop-pet');
    expect(packageJson.build.appId).toBe('cn.littleorange.desktop.pet');
    expect(packageJson.scripts['dist:update']).toContain('electron-builder.update.cjs');
    expect(packageJson.build.nsis.artifactName).toContain('${version}');
  });

  it('builds updates separately without deleting user data', () => {
    const config = read('electron-builder.update.cjs');
    expect(config).toContain("output: 'release/updates'");
    expect(config).toContain("artifactName: '小橙子桌宠-Update-${version}-x64.${ext}'");
    expect(config).toContain('deleteAppDataOnUninstall: false');
    expect(config).toContain('appId: baseBuild.appId');
  });
});
