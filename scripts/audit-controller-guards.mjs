#!/usr/bin/env node
// Fails the build if any NestJS controller in services/ehr-service/src has no
// auth guard and is not explicitly marked @Public(). Every controller must
// make an intentional choice — this catches the "forgot to add a guard" class
// of bug found in the S246 security audit (2026-08-25).
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CONTROLLERS_ROOT = path.join(ROOT, 'services/ehr-service/src');

async function findControllerFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findControllerFiles(full)));
    } else if (entry.name.endsWith('.controller.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await findControllerFiles(CONTROLLERS_ROOT);
  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (!content.includes('UseGuards') && !content.includes('@Public')) {
      violations.push(path.relative(ROOT, file));
    }
  }

  if (violations.length > 0) {
    console.error(`\n✗ ${violations.length} controller(s) have no auth guard and are not marked @Public():\n`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      '\nEvery controller must either @UseGuards(JwtAuthGuard | PatientJwtAuthGuard | ...) ' +
        'or be explicitly decorated @Public() with a comment explaining why.\n',
    );
    process.exit(1);
  }

  console.log(`✓ All ${files.length} controllers have an explicit guard or @Public() marker.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
