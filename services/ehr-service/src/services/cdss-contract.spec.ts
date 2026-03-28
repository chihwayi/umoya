import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...segments: string[]): string {
  const repoRoot = path.resolve(__dirname, '../../../../');
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

describe('CDSS contract drift guard', () => {
  it('keeps EHR CDSS endpoints aligned with cdss-service routes', () => {
    const ehrCdssService = readRepoFile('services', 'ehr-service', 'src', 'services', 'cdss.service.ts');
    const cdssMain = readRepoFile('services', 'cdss-service', 'main.py');
    let apiReference: string | null = null;
    try {
      apiReference = readRepoFile('docs', 'MEDICORE_SYSTEM_REFERENCE.md');
    } catch {
      // docs file not yet created — skip doc-coverage check
    }

    const ehrPaths = Array.from(
      ehrCdssService.matchAll(/postWithPolicy<[^>]*>\(\s*'[^']+',\s*'([^']+)'/g),
      (m) => m[1],
    );
    const uniqueEhrPaths = Array.from(new Set(ehrPaths)).sort();

    const cdssPaths = Array.from(
      cdssMain.matchAll(/@app\.(?:get|post|put|delete)\("([^"]+)"/g),
      (m) => m[1],
    );
    const cdssPathSet = new Set(cdssPaths);

    const missingInCdss = uniqueEhrPaths.filter((route) => !cdssPathSet.has(route));
    expect(missingInCdss).toEqual([]);

    const missingInDocs = apiReference
      ? uniqueEhrPaths.filter((route) => !apiReference!.includes(`\`${route}\``))
      : [];
    expect(missingInDocs).toEqual([]);
  });
});
