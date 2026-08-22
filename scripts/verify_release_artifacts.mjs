import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const setupName = 'Little-Orange-Desktop-Pet-Setup-x64.exe';
const updateName = 'Little-Orange-Desktop-Pet-Update-x64.exe';
const setupPath = path.join(root, 'release', setupName);
const updatePath = path.join(root, 'release', 'updates', updateName);
const manifestPath = path.join(root, 'release', 'updates', 'update-manifest.json');
const portablePath = path.join(root, 'release', '小橙子桌宠-Portable-x64.exe');
const nativeRelativePath = path.join(
  'resources',
  'app.asar.unpacked',
  'node_modules',
  'uiohook-napi',
  'prebuilds',
  'win32-x64',
  'node.napi.node',
);

function requireFile(filePath, label) {
  if (!existsSync(filePath) || statSync(filePath).size <= 0) {
    throw new Error(`${label} is missing or empty: ${filePath}`);
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function executableVersion(filePath) {
  if (process.platform !== 'win32') {
    throw new Error('Windows release artifacts must be verified on Windows');
  }
  const escapedPath = filePath.replaceAll("'", "''");
  const output = execFileSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `$item = Get-Item -LiteralPath '${escapedPath}'; `
      + '[pscustomobject]@{ ProductVersion = $item.VersionInfo.ProductVersion; FileVersion = $item.VersionInfo.FileVersion } '
      + '| ConvertTo-Json -Compress',
  ], { encoding: 'utf8' });
  return JSON.parse(output);
}

function requireExecutableVersion(filePath, label) {
  const versions = executableVersion(filePath);
  for (const key of ['ProductVersion', 'FileVersion']) {
    if (versions[key] !== packageJson.version) {
      throw new Error(`${label} ${key} ${versions[key]} does not match v${packageJson.version}`);
    }
  }
  return versions;
}

requireFile(setupPath, 'Setup artifact');
requireFile(updatePath, 'Update artifact');
requireFile(manifestPath, 'Update manifest');
const setupVersion = requireExecutableVersion(setupPath, 'Setup artifact');
const updateVersion = requireExecutableVersion(updatePath, 'Update artifact');

if (existsSync(portablePath)) {
  throw new Error(`Portable artifact must not be present for v${packageJson.version}: ${portablePath}`);
}

const setupNativePath = path.join(root, 'release', 'win-unpacked', nativeRelativePath);
const updateNativePath = path.join(root, 'release', 'updates', 'win-unpacked', nativeRelativePath);
requireFile(setupNativePath, 'Setup uiohook native binary');
requireFile(updateNativePath, 'Update uiohook native binary');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const updateSize = statSync(updatePath).size;
const updateSha256 = sha256(updatePath);
const expectedManifest = {
  product: packageJson.build.productName,
  appId: packageJson.build.appId,
  version: packageJson.version,
  updateMode: 'offline-cumulative',
  compatibleFrom: packageJson.releaseMetadata.compatibleFrom,
  artifact: updateName,
  size: updateSize,
  sha256: updateSha256,
  preservesUserData: true,
};

for (const [key, value] of Object.entries(expectedManifest)) {
  if (manifest[key] !== value) {
    throw new Error(`update-manifest.json field ${key} does not match the built artifact`);
  }
}
if (typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))) {
  throw new Error('update-manifest.json createdAt must be a valid ISO timestamp');
}

console.log(JSON.stringify({
  version: packageJson.version,
  setup: {
    name: setupName,
    size: statSync(setupPath).size,
    sha256: sha256(setupPath),
    ...setupVersion,
  },
  update: {
    name: updateName,
    size: updateSize,
    sha256: updateSha256,
    ...updateVersion,
  },
  manifest: {
    name: path.basename(manifestPath),
    size: statSync(manifestPath).size,
    sha256: sha256(manifestPath),
  },
  nativeBinaryBytes: {
    setup: statSync(setupNativePath).size,
    update: statSync(updateNativePath).size,
  },
}, null, 2));
