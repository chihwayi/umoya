import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const appConfigPath = path.join(cwd, 'app.config.ts');
const easPath = path.join(cwd, 'eas.json');
const pkgPath = path.join(cwd, 'package.json');

function assertExists(label, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function assertSemver(value, label) {
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semverPattern.test(value)) {
    throw new Error(`${label} must be semver. Received: ${value}`);
  }
}

function assertPositiveIntegerString(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer. Received: ${value}`);
  }
}

function main() {
  assertExists('app config', appConfigPath);
  assertExists('eas config', easPath);
  assertExists('package file', pkgPath);

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assertSemver(String(pkg.version || ''), 'mobile-app package version');

  const requestedVersion = process.env.MEDICORE_APP_VERSION;
  if (requestedVersion) {
    assertSemver(requestedVersion, 'MEDICORE_APP_VERSION');
  }

  if (process.env.MEDICORE_IOS_BUILD_NUMBER) {
    assertPositiveIntegerString(process.env.MEDICORE_IOS_BUILD_NUMBER, 'MEDICORE_IOS_BUILD_NUMBER');
  }

  if (process.env.MEDICORE_ANDROID_VERSION_CODE) {
    assertPositiveIntegerString(process.env.MEDICORE_ANDROID_VERSION_CODE, 'MEDICORE_ANDROID_VERSION_CODE');
  }

  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  const profiles = ['development', 'preview', 'production'];
  for (const profile of profiles) {
    if (!eas.build?.[profile]) {
      throw new Error(`Missing EAS profile: ${profile}`);
    }
  }

  console.log('[mobile-app:release] version strategy checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[mobile-app:release] version strategy checks failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
