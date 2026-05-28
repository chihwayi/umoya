import { ClinicalDocumentService } from './clinical-document.service';

function makeService() {
  return new ClinicalDocumentService();
}

function makeDb(patientRow?: any) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients'))
        return Promise.resolve(
          patientRow
            ? [patientRow]
            : [{ first_name: 'John', last_name: 'Doe', mrn: 'MRN001', sex: 'M' }],
        );
      if (sql.includes('patient_diagnoses'))
        return Promise.resolve([{ icd10_code: 'I10', description: 'Hypertension', status: 'chronic' }]);
      if (sql.includes('FROM prescriptions'))
        return Promise.resolve([{ drug_name: 'Amlodipine', dose: '5mg', frequency: 'once daily' }]);
      if (sql.includes('FROM lab_results'))
        return Promise.resolve([]);
      if (sql.includes('clinical_notes'))
        return Promise.resolve([]);
      if (sql.includes('FROM vitals'))
        return Promise.resolve([]);
      if (sql.includes('INSERT INTO clinical_documents'))
        return Promise.resolve([{ id: 'doc-1', content: 'REFERRAL...', status: 'draft' }]);
      if (sql.includes('UPDATE clinical_documents'))
        return Promise.resolve([{ id: 'doc-1', status: 'signed', signed_at: new Date() }]);
      return Promise.resolve([]);
    }),
  };
}

describe('ClinicalDocumentService', () => {
  it('generates referral letter from raw data', async () => {
    const svc = makeService();
    const db = makeDb();
    const result: any = await svc.generateDocument(
      'p1', 'referral_letter', 'doc1', db, { recipient: 'Dr. Smith' },
    );
    expect(result).toMatchObject({ id: 'doc-1', status: 'draft' });
  });

  it('generates discharge summary', async () => {
    const svc = makeService();
    const db = makeDb();
    const result: any = await svc.generateDocument(
      'p1', 'discharge_summary', 'doc1', db, { additionalContext: 'Chest pain' },
    );
    expect(result.id).toBe('doc-1');
  });

  it('signDocument returns signed record', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'doc-1', status: 'signed' }]) };
    const result: any = await svc.signDocument('doc-1', 'doc1', db);
    expect(result.status).toBe('signed');
  });

  it('getDocument returns null for unknown id', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getDocument('unknown', db);
    expect(result).toBeNull();
  });
});
