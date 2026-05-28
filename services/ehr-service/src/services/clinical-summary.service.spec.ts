import { ClinicalSummaryService } from './clinical-summary.service';
import { createHash } from 'crypto';

function makeService() {
  return new ClinicalSummaryService();
}

function makeDb(existingSummary: any = null) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients'))
        return Promise.resolve([{ first_name: 'Ana', last_name: 'Cruz', date_of_birth: '1970-06-01', sex: 'F' }]);
      if (sql.includes('patient_diagnoses'))
        return Promise.resolve([{ description: 'Hypertension', status: 'chronic', icd10_code: 'I10' }]);
      if (sql.includes('FROM prescriptions'))
        return Promise.resolve([{ drug_name: 'Amlodipine', dose: '5mg' }]);
      if (sql.includes('FROM lab_results'))
        return Promise.resolve([]);
      if (sql.includes('mortality_risk_scores'))
        return Promise.resolve([{ score: 35, band: 'moderate' }]);
      if (sql.includes('patient_ai_timeline'))
        return Promise.resolve([{ one_line_summary: 'Ana — hypertension' }]);
      if (sql.includes('SELECT *') && sql.includes('patient_clinical_summaries'))
        return Promise.resolve(existingSummary ? [existingSummary] : []);
      if (sql.includes('INSERT INTO patient_clinical_summaries'))
        return Promise.resolve([{ id: 's1', summary_text: 'Ana is a 55-year-old...', sentences: '[]', data_hash: 'x' }]);
      if (sql.includes('UPDATE patient_clinical_summaries'))
        return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('ClinicalSummaryService', () => {
  it('generates a summary containing patient name', async () => {
    const svc = makeService();
    const db = makeDb(null);
    const result: any = await svc.generateSummary('p1', db);
    expect(result.summary_text).toContain('Ana');
  });

  it('returns cached summary when data hash matches', async () => {
    const svc = makeService();
    const hash = createHash('md5').update(JSON.stringify({ d: 1, m: 1, l: 0 })).digest('hex');
    const db = makeDb({ id: 's1', summary_text: 'Cached summary', data_hash: hash, sentences: '[]' });
    const result: any = await svc.generateSummary('p1', db);
    expect(result).toBeTruthy();
  });

  it('submits positive feedback', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    await svc.submitFeedback('p1', true, db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('feedback_positive'),
      ['p1'],
    );
  });

  it('getSummary returns null for unknown patient', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getSummary('p-none', db);
    expect(result).toBeNull();
  });
});
