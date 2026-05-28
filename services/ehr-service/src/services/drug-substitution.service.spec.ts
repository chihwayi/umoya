import { DrugSubstitutionService } from './drug-substitution.service';

function makeService() {
  return new DrugSubstitutionService(undefined as any);
}

function makeDb() {
  return { query: jest.fn().mockResolvedValue([{ id: 1 }]) };
}

describe('DrugSubstitutionService', () => {
  it('returns rule-based fallback for known drug', async () => {
    const svc = makeService();
    const db = makeDb();
    const res = await svc.getSuggestions(db, {
      originalDrug: 'Amoxicillin 500mg',
      patientId: 1,
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].sourceType).toBe('rule');
    expect(res.suggestions[0].confidence).toBeGreaterThan(0);
  });

  it('returns empty suggestions for unknown drug', async () => {
    const svc = makeService();
    const db = makeDb();
    const res = await svc.getSuggestions(db, {
      originalDrug: 'XYZ-Unknown-9999',
      patientId: 2,
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(res.suggestions).toHaveLength(0);
  });

  it('persists suggestion row to DB', async () => {
    const svc = makeService();
    const db = makeDb();
    await svc.getSuggestions(db, {
      originalDrug: 'Metformin 500mg',
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO drug_substitution_suggestions'),
      expect.any(Array),
    );
  });

  it('selectSubstitute updates the record', async () => {
    const svc = makeService();
    const db = makeDb();
    await svc.selectSubstitute(db, 1, 'Ampicillin 500mg', 99);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE drug_substitution_suggestions'),
      expect.arrayContaining(['Ampicillin 500mg', 99, 1]),
    );
  });
});
