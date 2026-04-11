import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...segments: string[]): string {
  const repoRoot = path.resolve(__dirname, '../../../../');
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

function readCdssPythonFiles(): Array<{ file: string; content: string }> {
  const repoRoot = path.resolve(__dirname, '../../../../');
  const cdssDir = path.join(repoRoot, 'services', 'cdss-service');
  return fs
    .readdirSync(cdssDir)
    .filter((file) => file.endsWith('.py'))
    .map((file) => ({
      file,
      content: fs.readFileSync(path.join(cdssDir, file), 'utf8'),
    }));
}

function collectCdssRoutes(): string[] {
  const routes: string[] = [];

  for (const { content } of readCdssPythonFiles()) {
    const routerPrefixes = Array.from(
      content.matchAll(/router\s*=\s*APIRouter\(prefix="([^"]+)"/g),
      (m) => m[1],
    );
    const routerPrefix = routerPrefixes[0] ?? '';

    routes.push(
      ...Array.from(
        content.matchAll(/@app\.(get|post|put|delete)\("([^"]+)"/g),
        (m) => `${m[1].toUpperCase()} ${m[2]}`,
      ),
    );

    routes.push(
      ...Array.from(
        content.matchAll(/@router\.(get|post|put|delete)\("([^"]+)"/g),
        (m) => `${m[1].toUpperCase()} ${routerPrefix}${m[2]}`,
      ),
    );
  }

  return routes;
}

describe('CDSS contract drift guard', () => {
  it('keeps EHR CDSS endpoints aligned with cdss-service routes', () => {
    const ehrCdssService = readRepoFile('services', 'ehr-service', 'src', 'services', 'cdss.service.ts');
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

    const cdssPaths = collectCdssRoutes();
    const cdssPathSet = new Set(cdssPaths.map((route) => route.replace(/^(GET|POST|PUT|DELETE)\s+/, '')));

    const missingInCdss = uniqueEhrPaths.filter((route) => !cdssPathSet.has(route));
    expect(missingInCdss).toEqual([]);

    const missingInDocs = apiReference
      ? uniqueEhrPaths.filter((route) => !apiReference!.includes(`\`${route}\``))
      : [];
    expect(missingInDocs).toEqual([]);
  });

  it('does not define duplicate FastAPI method/path pairs', () => {
    const routes = collectCdssRoutes();
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
