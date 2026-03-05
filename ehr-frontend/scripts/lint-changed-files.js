#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function parseArgs(argv) {
  const opts = { strict: false };
  for (const arg of argv) {
    if (arg === '--strict') {
      opts.strict = true;
      continue;
    }
    if (arg.startsWith('--base=')) {
      opts.base = arg.slice('--base='.length);
      continue;
    }
    if (arg.startsWith('--head=')) {
      opts.head = arg.slice('--head='.length);
    }
  }
  return opts;
}

function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
}

function resolveRepoRoot() {
  const result = runGit(['rev-parse', '--show-toplevel'], frontendRoot);
  if (result.status === 0) {
    return result.stdout.trim();
  }
  return path.resolve(frontendRoot, '..');
}

function hasCommitRef(ref, cwd) {
  if (!ref) {
    return false;
  }
  const result = runGit(['rev-parse', '--verify', `${ref}^{commit}`], cwd);
  return result.status === 0;
}

function resolveBaseRef(opts, repoRoot) {
  const baseRefFromCi = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : null;
  const candidates = [
    opts.base,
    process.env.LINT_CHANGED_BASE,
    baseRefFromCi,
    'origin/main',
    'main',
    'HEAD~1',
  ];

  for (const candidate of candidates) {
    if (hasCommitRef(candidate, repoRoot)) {
      return candidate;
    }
  }
  return null;
}

function resolveHeadRef(opts, repoRoot) {
  const candidate = opts.head || process.env.LINT_CHANGED_HEAD || 'HEAD';
  if (hasCommitRef(candidate, repoRoot)) {
    return candidate;
  }
  return null;
}

function listChangedFiles(repoRoot, baseRef, headRef) {
  const tripleDotRange = `${baseRef}...${headRef}`;
  let result = runGit(['diff', '--name-only', '--diff-filter=ACMR', tripleDotRange], repoRoot);
  if (result.status !== 0) {
    const doubleDotRange = `${baseRef}..${headRef}`;
    result = runGit(['diff', '--name-only', '--diff-filter=ACMR', doubleDotRange], repoRoot);
  }

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => filePath.startsWith('ehr-frontend/src/'))
    .filter((filePath) => extensions.has(path.extname(filePath)));
}

function runEslint(projectFiles) {
  const eslintCli = path.join(frontendRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!fs.existsSync(eslintCli)) {
    console.error('Changed-files lint guard skipped: local eslint binary not found.');
    console.error('Run `npm install` at repo root first.');
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    [eslintCli, '--max-warnings=0', ...projectFiles],
    {
      cwd: frontendRoot,
      stdio: 'inherit',
    }
  );
  return result.status || 0;
}

const opts = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot();
const baseRef = resolveBaseRef(opts, repoRoot);
const headRef = resolveHeadRef(opts, repoRoot);

if (!baseRef || !headRef) {
  console.log('Changed-files lint guard skipped: unable to resolve git base/head refs.');
  process.exit(0);
}

const changedFiles = listChangedFiles(repoRoot, baseRef, headRef)
  .map((fullPath) => fullPath.replace(/^ehr-frontend\//, ''));

if (changedFiles.length === 0) {
  console.log(`Changed-files lint guard passed: no changed frontend source files (${baseRef}...${headRef}).`);
  process.exit(0);
}

console.log(
  `Running changed-files lint on ${changedFiles.length} file(s) against range ${baseRef}...${headRef}.`
);

const lintExitCode = runEslint(changedFiles);
if (lintExitCode === 0) {
  console.log('Changed-files lint guard passed.');
  process.exit(0);
}

if (opts.strict) {
  process.exit(lintExitCode);
}

console.warn('Changed-files lint guard detected issues (non-blocking mode).');
console.warn('Run `npm run lint:changed:strict` to enforce blocking behavior.');
process.exit(0);
