import { CareGapEngineService } from './care-gap-engine.service';

function makeDb(overrides: Record<string, any> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients'))
        return Promise.resolve(overrides.patient ?? [{ date_of_birth: '1980-01-01', sex: 'F' }]);
      if (sql.includes('patient_diagnoses'))
        return Promise.resolve(overrides.diagnoses ?? []);
      if (sql.includes('FROM lab_results'))
        return Promise.resolve(overrides.labs ?? []);
      if (sql.includes('vaccinations'))
        return Promise.resolve(overrides.vaccinations ?? []);
      if (sql.includes('FROM encounters'))
        return Promise.resolve(overrides.encounters ?? []);
      if (sql.includes('INSERT INTO care_gaps'))
        return Promise.resolve([]);
      if (sql.includes('SELECT * FROM care_gaps'))
        return Promise.resolve(overrides.gaps ?? []);
      if (sql.includes('UPDATE care_gaps'))
        return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('CareGapEngineService', () => {
  let svc: CareGapEngineService;
  beforeEach(() => { svc = new CareGapEngineService(); });

  it('detects cervical screening gap for woman aged 45 with no pap smear', async () => {
    const db = makeDb({ patient: [{ date_of_birth: '1980-01-01', sex: 'F' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'cervical_screening')).toBeTruthy();
  });

  it('does not flag cervical screening for male patient', async () => {
    const db = makeDb({ patient: [{ date_of_birth: '1980-01-01', sex: 'M' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'cervical_screening')).toBeUndefined();
  });

  it('detects HbA1c gap for diabetic patient', async () => {
    const db = makeDb({
      patient: [{ date_of_birth: '1970-01-01', sex: 'M' }],
      diagnoses: [{ icd10_code: 'E11', description: 'T2DM', status: 'chronic' }],
    });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'diabetes_hba1c')).toBeTruthy();
  });

  it('detects lapsed follow-up when last encounter was >90 days ago', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString();
    const db = makeDb({ encounters: [{ created_at: oldDate, status: 'completed' }] });
    const gaps = await svc.detectGaps('p1', db);
    expect(gaps.find((g) => g.gapType === 'lapsed_followup')).toBeTruthy();
  });

  it('dismissGap updates status and sets dismissed_until', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    await svc.dismissGap('gap-1', 'doc-1', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('dismissed_until'),
      expect.any(Array),
    );
  });
});
