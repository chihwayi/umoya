import { ClinicalTimelineService } from './clinical-timeline.service';

function makeService() {
  return new ClinicalTimelineService();
}

function makeDb(existingTimeline: any = null) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients'))
        return Promise.resolve([{ first_name: 'Jane', last_name: 'Doe', date_of_birth: '1975-01-01', sex: 'F' }]);
      if (sql.includes('patient_diagnoses'))
        return Promise.resolve([{ icd10_code: 'E11', description: 'T2DM', status: 'chronic', diagnosed_at: '2020-01-01' }]);
      if (sql.includes('FROM lab_results')) return Promise.resolve([]);
      if (sql.includes('FROM prescriptions')) return Promise.resolve([]);
      if (sql.includes('FROM encounters')) return Promise.resolve([]);
      if (sql.includes('FROM vitals')) return Promise.resolve([]);
      if (sql.includes('FROM patient_ai_timeline') && sql.includes('SELECT'))
        return Promise.resolve(existingTimeline ? [existingTimeline] : []);
      if (sql.includes('INSERT INTO patient_ai_timeline'))
        return Promise.resolve([{ id: 'tl1', one_line_summary: 'Jane — T2DM', full_narrative: 'Jane is a 49y female...' }]);
      return Promise.resolve([]);
    }),
  };
}

describe('ClinicalTimelineService', () => {
  it('generates new timeline when none exists', async () => {
    const svc = makeService();
    const db = makeDb(null);
    const result: any = await svc.generateTimeline('p1', db);
    expect(result).toMatchObject({ id: 'tl1' });
  });

  it('returns cached timeline when data hash unchanged', async () => {
    const svc = makeService();
    const dataKey = JSON.stringify({ diagnoses: 1, labs: 0, meds: 0 });
    const { createHash } = require('crypto');
    const dataHash = createHash('md5').update(dataKey).digest('hex');
    const cached = { data_hash: dataHash, full_narrative: 'Cached', one_line_summary: 'Jane — T2DM', generated_at: new Date() };
    const db = makeDb(cached);
    const result: any = await svc.generateTimeline('p1', db);
    expect(result.full_narrative).toBe('Cached');
  });

  it('detectPatterns finds recurring infections', () => {
    const svc = makeService() as any;
    const diagnoses = [
      { icd10_code: 'A09', description: 'Gastroenteritis', diagnosed_at: '2023-01-01' },
      { icd10_code: 'A09', description: 'Gastroenteritis', diagnosed_at: '2023-06-01' },
      { icd10_code: 'B34', description: 'Viral infection', diagnosed_at: '2024-01-01' },
    ];
    const patterns = svc.detectPatterns(diagnoses, [], [], []);
    expect(patterns.find((p: any) => p.type === 'recurring_infection')).toBeTruthy();
  });

  it('getTimeline returns null when no record', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getTimeline('p-none', db);
    expect(result).toBeNull();
  });
});
