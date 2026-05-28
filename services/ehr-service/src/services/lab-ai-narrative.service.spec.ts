import { LabAiNarrativeService } from './lab-ai-narrative.service';

function makeService(cdss?: any, alert?: any, abstention?: any) {
  return new LabAiNarrativeService(
    cdss ?? null,
    alert ?? null,
    abstention ?? null,
  );
}

const mockResult = {
  id: 'r1', patient_id: 'p1', test_name: 'Haemoglobin',
  value: '12', unit: 'g/dL', reference_range: '13-17', flag: 'L',
};

function makeDb(result: any = mockResult) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM lab_results lr')) return Promise.resolve(result ? [result] : []);
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'Jane', date_of_birth: '1980-01-01', sex: 'F' }]);
      if (sql.includes('FROM lab_results') && sql.includes('ORDER BY')) return Promise.resolve([]);
      if (sql.includes('INSERT INTO lab_ai_narratives')) {
        return Promise.resolve([{
          id: 'n1',
          clinician_narrative: 'Mild anaemia.',
          patient_narrative: 'Your iron is low.',
          has_critical_value: false,
          alert_sent: false,
        }]);
      }
      if (sql.includes('UPDATE lab_ai_narratives')) return Promise.resolve([]);
      if (sql.includes('SELECT * FROM lab_ai_narratives')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('LabAiNarrativeService', () => {
  it('generates narrative via CDSS', async () => {
    const cdss = {
      interpretLabResults: jest.fn().mockResolvedValue({
        interpretations: [{
          clinician_narrative: 'Mild anaemia.',
          patient_narrative: 'Your iron is low.',
          key_findings: [],
          is_critical: false,
        }],
        summary: { critical: 0 },
        critical_alerts: [],
      }),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(cdss.interpretLabResults).toHaveBeenCalled();
  });

  it('uses abstention narrative when CDSS is null', async () => {
    const abstention = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(null, null, abstention);
    const db = makeDb();
    await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(abstention.log).toHaveBeenCalledWith(db, 'lab_interpretation', 'not_configured', expect.any(Object));
  });

  it('sends critical alert for HH flag', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(null, alert);
    const db = makeDb({ ...mockResult, flag: 'HH', alert_sent: false });
    await svc.generateNarrative('r1', 'p1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('getNarrative returns null when no record exists', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getNarrative('r-none', db);
    expect(result).toBeNull();
  });
});
