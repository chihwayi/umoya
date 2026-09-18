#!/usr/bin/env node
// @livekit/react-native@2.5.0's android/build.gradle still references the
// long-shutdown jcenter() repository, which recent Gradle/AGP refuses to
// resolve ("Could not find method jcenter()"). Strip it post-install so
// `assembleRelease`/`assembleDebug` builds keep working without needing a
// newer SDK version (newer ones bundle a livekit-client incompatible with
// our self-hosted livekit-server — see the telemedicine migration notes).
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@livekit', 'react-native', 'android', 'build.gradle');

if (!fs.existsSync(target)) {
  console.log('[patch-livekit-gradle] target not found, skipping:', target);
  process.exit(0);
}

const before = fs.readFileSync(target, 'utf8');
const after = before.replace(/^\s*jcenter\(\)\s*\n/gm, '');

if (before === after) {
  console.log('[patch-livekit-gradle] no jcenter() calls found, already clean');
} else {
  fs.writeFileSync(target, after);
  console.log('[patch-livekit-gradle] removed jcenter() from', target);
}
