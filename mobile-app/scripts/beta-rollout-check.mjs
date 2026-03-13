import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const strict = process.argv.includes('--strict');

const requiredFiles = ['eas.json', 'app.config.ts', 'package.json'];
for (const file of requiredFiles) {
  const full = path.join(cwd, file);
  if (!fs.existsSync(full)) {
    console.error(`[mobile-app:beta] missing required file: ${file}`);
    process.exit(1);
  }
}

const eas = JSON.parse(fs.readFileSync(path.join(cwd, 'eas.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));

const missingProfiles = ['development', 'preview', 'production'].filter((name) => !eas?.build?.[name]);
if (missingProfiles.length > 0) {
  console.error(`[mobile-app:beta] missing EAS profiles: ${missingProfiles.join(', ')}`);
  process.exit(1);
}

const missingScripts = ['build:android:preview', 'build:ios:preview', 'release:check'].filter(
  (name) => !pkg?.scripts?.[name]
);
if (missingScripts.length > 0) {
  console.error(`[mobile-app:beta] missing npm scripts: ${missingScripts.join(', ')}`);
  process.exit(1);
}

const checks = [
  { key: 'EXPO_PUBLIC_RELEASE_CHANNEL', value: process.env.EXPO_PUBLIC_RELEASE_CHANNEL },
  { key: 'EXPO_PUBLIC_RELEASE_ENV', value: process.env.EXPO_PUBLIC_RELEASE_ENV },
  { key: 'EXPO_PUBLIC_SENTRY_DSN', value: process.env.EXPO_PUBLIC_SENTRY_DSN },
  { key: 'EXPO_PUBLIC_SUPPORT_EMAIL', value: process.env.EXPO_PUBLIC_SUPPORT_EMAIL },
  { key: 'EXPO_PUBLIC_SUPPORT_PHONE', value: process.env.EXPO_PUBLIC_SUPPORT_PHONE }
];

const missingEnv = checks.filter((item) => !item.value).map((item) => item.key);

if (missingEnv.length > 0 && strict) {
  console.error(`[mobile-app:beta] missing required env in strict mode: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (missingEnv.length > 0) {
  console.warn(`[mobile-app:beta] warning: missing env (non-strict): ${missingEnv.join(', ')}`);
}

console.log('[mobile-app:beta] rollout readiness checks passed.');
