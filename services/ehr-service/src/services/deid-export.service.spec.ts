import { DeidExportService } from './deid-export.service';

describe('DeidExportService', () => {
  const svc = new DeidExportService();

  it('removes national_id and full_name, keeps non-PHI fields', () => {
    const result = svc.deidentifyRecord({
      national_id: '12345', full_name: 'John Doe', sex: 'M', art_status: 'on_art',
    });
    expect(result.national_id).toBeUndefined();
    expect(result.full_name).toBeUndefined();
    expect(result.sex).toBe('M');
    expect(result.art_status).toBe('on_art');
  });

  it('generalises age 33 to 5-year band 30-34', () => {
    const result = svc.deidentifyRecord({ age: 33, sex: 'F' });
    expect(result.age).toBe('30-34');
  });

  it('generalises dates to YYYY-MM (removes day)', () => {
    const result = svc.deidentifyRecord({ visit_date: '2026-05-17', sex: 'M' });
    expect(result.visit_date).toBe('2026-05');
  });

  it('replaces age >= 90 with "90+" to prevent re-identification', () => {
    const result = svc.deidentifyRecord({ age: 93 });
    expect(result.age).toBe('90+');
  });
});
