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

    const postWithPolicyPaths = Array.from(
      ehrCdssService.matchAll(/postWithPolicy<[^>]*>\(\s*'[^']+',\s*'([^']+)'/g),
      (m) => m[1],
    );
    const requestWithPolicyPaths = Array.from(
      ehrCdssService.matchAll(/requestWithPolicy<[^>]*>\(\s*'[^']+',\s*'[^']+',\s*'([^']+)'/g),
      (m) => m[1],
    );
    const getWithPolicyPaths = Array.from(
      ehrCdssService.matchAll(/getWithPolicy<[^>]*>\(\s*'[^']+',\s*'([^']+)'/g),
      (m) => m[1],
    );
    const uniqueEhrPaths = Array.from(
      new Set([...postWithPolicyPaths, ...requestWithPolicyPaths, ...getWithPolicyPaths]),
    ).sort();

    const cdssPaths = Array.from(
      cdssMain.matchAll(/@app\.(get|post|put|delete)\("([^"]+)"/g),
      (m) => `${m[1].toUpperCase()} ${m[2]}`,
    );
    const cdssPathSet = new Set(cdssPaths.map((route) => route.replace(/^(GET|POST|PUT|DELETE)\s+/, '')));

    const missingInCdss = uniqueEhrPaths.filter((route) => !cdssPathSet.has(route));
    expect(missingInCdss).toEqual([]);

    const missingInDocs = apiReference
      ? uniqueEhrPaths.filter((route) => !apiReference!.includes(`\`${route}\``))
      : [];
    expect(missingInDocs).toEqual([]);
  });

  it('does not define duplicate FastAPI method/path pairs', () => {
    const cdssMain = readRepoFile('services', 'cdss-service', 'main.py');
    const routes = Array.from(
      cdssMain.matchAll(/@app\.(get|post|put|delete)\("([^"]+)"/g),
      (m) => `${m[1].toUpperCase()} ${m[2]}`,
    );
    const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
    expect(Array.from(new Set(duplicates))).toEqual([]);
  });

  it('keeps registration document scope mapping explicit on both EHR and CDSS sides', () => {
    const ehrCdssService = readRepoFile('services', 'ehr-service', 'src', 'services', 'cdss.service.ts');
    const cdssMain = readRepoFile('services', 'cdss-service', 'main.py');
    expect(ehrCdssService).toContain(`'/registration/documents/analyze'`);
    expect(ehrCdssService).toContain(`'cdss.copilot.registration.write'`);
    expect(cdssMain).toContain(`if path == "/registration/documents/analyze" and m == "POST":`);
    expect(cdssMain).toContain(`return "cdss.copilot.registration.write"`);
  });
});
