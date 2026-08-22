import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('offline cumulative update release', () => {
  it('keeps the stable application identity and stable release artifact names', () => {
    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.name).toBe('little-orange-desktop-pet');
    expect(packageJson.build.appId).toBe('cn.littleorange.desktop.pet');
    expect(packageJson.version).toBe('1.2.3');
    expect(packageJson.releaseMetadata.compatibleFrom).toBe('1.0.0');
    expect(packageJson.scripts['dist:update']).toContain('electron-builder.update.cjs');
    expect(packageJson.scripts['dist:win']).toBe('npm run dist:setup');
    expect(packageJson.scripts['dist:setup']).toContain('--publish never');
    expect(packageJson.scripts['dist:update']).toContain('--publish never');
    expect(packageJson.build.win.target).toEqual(['nsis']);
    expect(packageJson.build.electronDist).toBe('node_modules/electron/dist');
    expect(packageJson.build.asarUnpack).toContain('node_modules/uiohook-napi/**');
    expect(packageJson.build.nsis.artifactName).toBe('Little-Orange-Desktop-Pet-Setup-x64.${ext}');
    expect(packageJson.build.win.target).not.toContain('portable');
  });

  it('builds updates separately without deleting user data', () => {
    const config = read('electron-builder.update.cjs');
    expect(config).toContain("output: 'release/updates'");
    expect(config).toContain("artifactName: 'Little-Orange-Desktop-Pet-Update-x64.${ext}'");
    expect(config).toContain('deleteAppDataOnUninstall: false');
    expect(config).toContain('appId: baseBuild.appId');
    expect(config).toContain('electronDist: baseBuild.electronDist');
    expect(config).toContain('asarUnpack: baseBuild.asarUnpack');
    expect(read('scripts/write_update_manifest.mjs')).toContain('packageJson.releaseMetadata?.compatibleFrom');
    expect(read('scripts/write_update_manifest.mjs')).toContain("const artifact = 'Little-Orange-Desktop-Pet-Update-x64.exe'");
    expect(read('scripts/verify_release_artifacts.mjs')).toContain('VersionInfo.ProductVersion');
    expect(read('scripts/verify_release_artifacts.mjs')).toContain('VersionInfo.FileVersion');
  });

  it('installs the Electron runtime before the Windows packaging gate', () => {
    const workflow = read('.github/workflows/windows-release.yml');
    const installRuntime = workflow.indexOf('node node_modules/electron/install.js');
    const buildSetup = workflow.indexOf('run: npm run dist:setup');
    expect(workflow).toContain('Remove-Item Env:ELECTRON_SKIP_BINARY_DOWNLOAD');
    expect(installRuntime).toBeGreaterThan(-1);
    expect(buildSetup).toBeGreaterThan(installRuntime);
  });
});
