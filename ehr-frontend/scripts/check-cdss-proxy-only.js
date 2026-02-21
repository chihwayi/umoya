#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

const forbiddenRules = [
  {
    id: 'cdss-env-var',
    description: 'Direct CDSS browser URL variable is not allowed',
    regex: /REACT_APP_CDSS_API_URL/g,
  },
  {
    id: 'absolute-cdss-url',
    description: 'Direct absolute CDSS URL in frontend code is not allowed',
    regex: /https?:\/\/[^\s'"`]*cdss[^\s'"`]*/gi,
  },
  {
    id: 'absolute-cdss-fetch-axios',
    description: 'Direct fetch/axios call to an absolute CDSS URL is not allowed',
    regex: /\b(?:fetch|axios(?:\.[a-z]+)?)\s*\(\s*(['"`])https?:\/\/[^'"`\n]*cdss[^'"`\n]*\1/gi,
  },
];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectViolations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (const rule of forbiddenRules) {
    for (let i = 0; i < lines.length; i += 1) {
      if (rule.regex.test(lines[i])) {
        violations.push({
          file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
          line: i + 1,
          rule: rule.id,
          description: rule.description,
        });
      }
      rule.regex.lastIndex = 0;
    }
  }

  return violations;
}

if (!fs.existsSync(srcRoot)) {
  console.error(`CDSS proxy guard failed: source path not found: ${srcRoot}`);
  process.exit(1);
}

const sourceFiles = walkFiles(srcRoot);
const violations = [];

for (const filePath of sourceFiles) {
  violations.push(...collectViolations(filePath));
}

if (violations.length > 0) {
  console.error('CDSS proxy-only guard failed.\n');
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.description}`
    );
  }
  console.error(
    '\nUse EHR proxy routes (`ehrAxios`/`cdssApi`) instead of direct browser-to-CDSS URLs.'
  );
  process.exit(1);
}

console.log('CDSS proxy-only guard passed: no direct browser-to-CDSS URLs found.');
