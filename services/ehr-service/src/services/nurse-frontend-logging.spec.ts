import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...segments: string[]): string {
  const repoRoot = path.resolve(__dirname, '../../../../');
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

describe('Nurse frontend logging guard', () => {
  it('keeps tracked nurse-facing UI files free of browser console logging', () => {
    const nurseFrontendFiles = [
      ['ehr-frontend', 'src', 'pages', 'NurseDashboard.tsx'],
      ['ehr-frontend', 'src', 'pages', 'NursePatientSummary.tsx'],
      ['ehr-frontend', 'src', 'components', 'TriageQueue.tsx'],
      ['ehr-frontend', 'src', 'components', 'VitalsPanel.tsx'],
      ['ehr-frontend', 'src', 'components', 'NursingNotes.tsx'],
      ['ehr-frontend', 'src', 'components', 'TaskManagement.tsx'],
      ['ehr-frontend', 'src', 'components', 'PatientSafetyAlerts.tsx'],
    ] as const;

    const offenders = nurseFrontendFiles.flatMap((segments) => {
      const fileContents = readRepoFile(...segments);
      const matches = Array.from(fileContents.matchAll(/\bconsole\.(?:log|debug|info|warn|error)\s*\(/g));
      const relativePath = segments.join('/');
      return matches.map((match) => `${relativePath}:${match.index}`);
    });

    expect(offenders).toEqual([]);
  });
});
