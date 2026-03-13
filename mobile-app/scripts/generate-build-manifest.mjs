import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cwd = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf8'));
}

function arg(name, fallback) {
  const pref = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(pref));
  if (!found) return fallback;
  return found.slice(pref.length);
}

const profile = arg('profile', process.env.MEDICORE_BUILD_PROFILE || 'preview');
const platform = arg('platform', process.env.MEDICORE_BUILD_PLATFORM || 'android');

const pkg = readJson('package.json');
const eas = readJson('eas.json');

const releaseChannel =
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL || eas?.build?.[profile]?.env?.EXPO_PUBLIC_RELEASE_CHANNEL || profile;
const releaseEnvironment =
  process.env.EXPO_PUBLIC_RELEASE_ENV || eas?.build?.[profile]?.env?.EXPO_PUBLIC_RELEASE_ENV || 'unknown';

const commitSha = execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const shortSha = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
  .toString()
  .trim();

const now = new Date();
const iso = now.toISOString();
const stamp = iso.replace(/[:.]/g, '-');

const manifest = {
  generatedAt: iso,
  commitSha,
  commitShortSha: shortSha,
  appVersion: pkg.version,
  profile,
  platform,
  releaseChannel,
  releaseEnvironment,
  iosBuildNumber: process.env.MEDICORE_IOS_BUILD_NUMBER || null,
  androidVersionCode: process.env.MEDICORE_ANDROID_VERSION_CODE || null
};

const outDir = path.join(cwd, '..', 'reports', 'mobile');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `build-manifest-${stamp}-${platform}-${profile}.json`);
fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[mobile-app:build-manifest] wrote ${outFile}`);
