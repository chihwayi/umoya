import { LabAiNarrativeService } from './lab-ai-narrative.service';

const mockResult = {
  id: 'r1', testName: 'Haemoglobin', value: '12', unit: 'g/dL', referenceRange: '13-17', flag: 'L',
};

function makeLabOrderService(result: any = mockResult) {
  return {
    findByResultId: jest.fn().mockResolvedValue(
      result ? { order: { patientId: 'p1' }, result } : null,
    ),
    getPreviousResultValues: jest.fn().mockResolvedValue([]),
  };
}

function makeService(labOrderService?: any, cdss?: any, alert?: any, abstention?: any) {
  return new LabAiNarrativeService(
    labOrderService ?? makeLabOrderService(),
    cdss ?? null,
    alert ?? null,
    abstention ?? null,
  );
}

function makeDb() {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'Jane', date_of_birth: '1980-01-01', sex: 'F' }]);
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
    const svc = makeService(undefined, cdss);
    const db = makeDb();
    await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(cdss.interpretLabResults).toHaveBeenCalled();
  });

  it('uses abstention narrative when CDSS is null', async () => {
    const abstention = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(undefined, null, null, abstention);
    const db = makeDb();
    await svc.generateNarrative('r1', 'p1', db, 'test');
    expect(abstention.log).toHaveBeenCalledWith(db, 'lab_interpretation', 'not_configured', expect.any(Object));
  });

  it('sends critical alert for HH flag', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const labOrderService = makeLabOrderService({ ...mockResult, flag: 'HH' });
    const svc = makeService(labOrderService, null, alert);
    const db = makeDb();
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
