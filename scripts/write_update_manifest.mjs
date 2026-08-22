import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const compatibleFrom = packageJson.releaseMetadata?.compatibleFrom;
if (typeof compatibleFrom !== 'string' || !/^\d+\.\d+\.\d+$/.test(compatibleFrom)) {
  throw new Error('package.json releaseMetadata.compatibleFrom must be a semantic version');
}
const artifact = '小橙子桌宠-Update-x64.exe';
const outputDirectory = path.join(root, 'release', 'updates');
const artifactPath = path.join(outputDirectory, artifact);
const bytes = readFileSync(artifactPath);

const manifest = {
  product: packageJson.build.productName,
  appId: packageJson.build.appId,
  version: packageJson.version,
  updateMode: 'offline-cumulative',
  compatibleFrom,
  artifact,
  size: statSync(artifactPath).size,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  preservesUserData: true,
  createdAt: new Date().toISOString(),
};

writeFileSync(path.join(outputDirectory, 'update-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote update manifest for ${artifact}`);
