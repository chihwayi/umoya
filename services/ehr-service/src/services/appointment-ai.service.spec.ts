import { AppointmentAiService } from './appointment-ai.service';

function makeService() {
  return new AppointmentAiService(null);
}

const defaultApptRow = {
  id: 'a1', patient_id: 'p1', doctor_id: 'doc1',
  first_name: 'John', last_name: 'Doe',
  date_of_birth: '1980-01-01', sex: 'M',
  appointment_type: 'consultation',
};

function makeDb(apptRow: any = defaultApptRow) {
  return {
    query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('FROM appointments a')) return Promise.resolve([apptRow]);
      if (sql.includes("status = 'no_show'")) return Promise.resolve([{ cnt: '2' }]);
      if (sql.includes("status IN ('completed'")) return Promise.resolve([{ cnt: '10' }]);
      if (sql.includes('EXTRACT(DOW')) return Promise.resolve([{ ...apptRow, dow: '2' }]);
      if (sql.includes('patient_diagnoses')) return Promise.resolve([{ icd10_code: 'E11', description: 'T2DM', status: 'chronic' }]);
      if (sql.includes('lab_results')) return Promise.resolve([]);
      if (sql.includes('prescriptions')) return Promise.resolve([]);
      if (sql.includes('clinical_tasks')) return Promise.resolve([]);
      if (sql.includes('INSERT INTO appointment_ai_briefs')) {
        return Promise.resolve([{ id: 'b1', brief_text: params?.[3] ?? 'PATIENT: ...' }]);
      }
      if (sql.includes('INSERT INTO appointment_noshow_scores')) return Promise.resolve([]);
      if (sql.includes('SELECT * FROM appointment_ai_briefs')) return Promise.resolve([]);
      if (sql.includes('SELECT * FROM appointment_noshow_scores')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('AppointmentAiService', () => {
  it('scores no-show based on history', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scoreNoShow('appt-1', 'p1', db);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(result.riskLevel);
  });

  it('generates brief from raw data', async () => {
    const svc = makeService();
    const db = makeDb();
    const result: any = await svc.generateBrief('a1', db);
    expect(result.brief_text).toContain('John');
  });

  it('brief includes active diagnoses', async () => {
    const svc = makeService();
    const db = makeDb();
    const result: any = await svc.generateBrief('a1', db);
    expect(result.brief_text).toContain('T2DM');
  });

  it('getBrief returns null if no record', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getBrief('a-none', db);
    expect(result).toBeNull();
  });
});
