import { EarlyWarningService, News2Input } from './early-warning.service';

let service: EarlyWarningService;

beforeEach(() => {
  service = new EarlyWarningService(null as any, null as any);
});

describe('EarlyWarningService', () => {
  describe('calculateNews2 - all normal vitals', () => {
    it('should return NEWS2 = 0 and risk = low for normal vitals', () => {
      const input: News2Input = {
        patientId: 'pat-1',
        respiratoryRate: 16,
        spo2: 97,
        onSupplementalOxygen: false,
        temperature: 37.0,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBe(0);
      expect(result.riskLevel).toBe('low');
      expect(result.alertTriggered).toBe(false);
    });

    it('should have 6 component scores', () => {
      const input: News2Input = {
        patientId: 'pat-1',
        respiratoryRate: 16,
        spo2: 97,
        temperature: 37.0,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.components).toHaveLength(6);
    });
  });

  describe('calculateNews2 - high acuity vitals', () => {
    it('should return high risk for severe vitals combination', () => {
      const input: News2Input = {
        patientId: 'pat-1',
        respiratoryRate: 25,
        spo2: 91,
        onSupplementalOxygen: false,
        temperature: 39.5,
        systolicBp: 85,
        heartRate: 130,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeGreaterThanOrEqual(7);
      expect(result.riskLevel).toBe('high');
      expect(result.alertTriggered).toBe(true);
    });

    it('should return critical total for worst-case vitals', () => {
      const input: News2Input = {
        patientId: 'pat-1',
        respiratoryRate: 7,
        spo2: 85,
        onSupplementalOxygen: true,
        temperature: 34.5,
        systolicBp: 80,
        heartRate: 135,
        consciousness: 'unresponsive',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeGreaterThanOrEqual(15);
      expect(result.riskLevel).toBe('high');
      expect(result.alertTriggered).toBe(true);
    });
  });

  describe('calculateNews2 - respiratory rate scoring', () => {
    it('should score 3 for RR <= 8', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: 7 });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(3);
    });

    it('should score 1 for RR 9-11', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: 10 });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(1);
    });

    it('should score 0 for RR 12-20', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: 16 });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(0);
    });

    it('should score 2 for RR 21-24', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: 22 });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(2);
    });

    it('should score 3 for RR >= 25', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: 28 });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(3);
    });
  });

  describe('calculateNews2 - SpO2 scoring', () => {
    it('should score 3 for SpO2 <= 91', () => {
      const result = service.calculateNews2({ patientId: 'p', spo2: 89, onSupplementalOxygen: false });
      const spo2 = result.components.find(c => c.parameter === 'spo2');
      expect(spo2!.score).toBe(3);
    });

    it('should score 2 for SpO2 92-93 on air', () => {
      const result = service.calculateNews2({ patientId: 'p', spo2: 93, onSupplementalOxygen: false });
      const spo2 = result.components.find(c => c.parameter === 'spo2');
      expect(spo2!.score).toBe(2);
    });

    it('should score 1 for SpO2 94-95', () => {
      const result = service.calculateNews2({ patientId: 'p', spo2: 94, onSupplementalOxygen: false });
      const spo2 = result.components.find(c => c.parameter === 'spo2');
      expect(spo2!.score).toBe(1);
    });

    it('should score 0 for SpO2 >= 96', () => {
      const result = service.calculateNews2({ patientId: 'p', spo2: 98, onSupplementalOxygen: false });
      const spo2 = result.components.find(c => c.parameter === 'spo2');
      expect(spo2!.score).toBe(0);
    });

    it('should add 2 points penalty for supplemental O2', () => {
      const withO2 = service.calculateNews2({ patientId: 'p', spo2: 96, onSupplementalOxygen: true });
      const withoutO2 = service.calculateNews2({ patientId: 'p', spo2: 96, onSupplementalOxygen: false });
      const spo2With = withO2.components.find(c => c.parameter === 'spo2');
      const spo2Without = withoutO2.components.find(c => c.parameter === 'spo2');
      expect(spo2With!.score - spo2Without!.score).toBe(2);
    });
  });

  describe('calculateNews2 - temperature scoring', () => {
    it('should score 3 for temp <= 35.0', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: 34.8 });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(3);
    });

    it('should score 1 for temp 35.1-36.0', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: 35.5 });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(1);
    });

    it('should score 0 for temp 36.1-38.0', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: 37.2 });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(0);
    });

    it('should score 1 for temp 38.1-39.0', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: 38.5 });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(1);
    });

    it('should score 2 for temp >= 39.1', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: 39.5 });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(2);
    });
  });

  describe('calculateNews2 - systolic BP scoring', () => {
    it('should score 3 for SBP <= 90', () => {
      const result = service.calculateNews2({ patientId: 'p', systolicBp: 85 });
      const bp = result.components.find(c => c.parameter === 'systolicBp');
      expect(bp!.score).toBe(3);
    });

    it('should score 2 for SBP 91-100', () => {
      const result = service.calculateNews2({ patientId: 'p', systolicBp: 95 });
      const bp = result.components.find(c => c.parameter === 'systolicBp');
      expect(bp!.score).toBe(2);
    });

    it('should score 1 for SBP 101-110', () => {
      const result = service.calculateNews2({ patientId: 'p', systolicBp: 105 });
      const bp = result.components.find(c => c.parameter === 'systolicBp');
      expect(bp!.score).toBe(1);
    });

    it('should score 0 for SBP 111-219', () => {
      const result = service.calculateNews2({ patientId: 'p', systolicBp: 130 });
      const bp = result.components.find(c => c.parameter === 'systolicBp');
      expect(bp!.score).toBe(0);
    });

    it('should score 3 for SBP >= 220', () => {
      const result = service.calculateNews2({ patientId: 'p', systolicBp: 230 });
      const bp = result.components.find(c => c.parameter === 'systolicBp');
      expect(bp!.score).toBe(3);
    });
  });

  describe('calculateNews2 - heart rate scoring', () => {
    it('should score 3 for HR <= 40', () => {
      const result = service.calculateNews2({ patientId: 'p', heartRate: 38 });
      const hr = result.components.find(c => c.parameter === 'heartRate');
      expect(hr!.score).toBe(3);
    });

    it('should score 1 for HR 41-50', () => {
      const result = service.calculateNews2({ patientId: 'p', heartRate: 45 });
      const hr = result.components.find(c => c.parameter === 'heartRate');
      expect(hr!.score).toBe(1);
    });

    it('should score 0 for HR 51-90', () => {
      const result = service.calculateNews2({ patientId: 'p', heartRate: 75 });
      const hr = result.components.find(c => c.parameter === 'heartRate');
      expect(hr!.score).toBe(0);
    });

    it('should score 2 for HR 111-130', () => {
      const result = service.calculateNews2({ patientId: 'p', heartRate: 125 });
      const hr = result.components.find(c => c.parameter === 'heartRate');
      expect(hr!.score).toBe(2);
    });

    it('should score 3 for HR >= 131', () => {
      const result = service.calculateNews2({ patientId: 'p', heartRate: 140 });
      const hr = result.components.find(c => c.parameter === 'heartRate');
      expect(hr!.score).toBe(3);
    });
  });

  describe('calculateNews2 - consciousness scoring', () => {
    it('should score 0 for alert', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: 'alert' });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(0);
    });

    it('should score 3 for voice', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: 'voice' });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(3);
    });

    it('should score 3 for pain', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: 'pain' });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(3);
    });

    it('should score 3 for unresponsive', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: 'unresponsive' });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(3);
    });

    it('should score 3 for confused', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: 'confused' });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(3);
    });
  });

  describe('calculateNews2 - missing values', () => {
    it('should handle missing respiratory rate gracefully (score 0)', () => {
      const result = service.calculateNews2({ patientId: 'p', respiratoryRate: null });
      const rr = result.components.find(c => c.parameter === 'respiratoryRate');
      expect(rr!.score).toBe(0);
      expect(rr!.value).toBeNull();
      expect(rr!.rationale).toBe('missing');
    });

    it('should handle missing SpO2 gracefully', () => {
      const result = service.calculateNews2({ patientId: 'p', spo2: null });
      const spo2 = result.components.find(c => c.parameter === 'spo2');
      expect(spo2!.score).toBe(0);
      expect(spo2!.rationale).toBe('missing');
    });

    it('should handle missing temperature gracefully', () => {
      const result = service.calculateNews2({ patientId: 'p', temperature: null });
      const temp = result.components.find(c => c.parameter === 'temperature');
      expect(temp!.score).toBe(0);
      expect(temp!.rationale).toBe('missing');
    });

    it('should handle all missing vitals (only patientId)', () => {
      const result = service.calculateNews2({ patientId: 'p' });

      expect(result.totalScore).toBe(0);
      expect(result.riskLevel).toBe('low');
      expect(result.alertTriggered).toBe(false);
    });

    it('should default consciousness to alert when null', () => {
      const result = service.calculateNews2({ patientId: 'p', consciousness: null });
      const c = result.components.find(comp => comp.parameter === 'consciousness');
      expect(c!.score).toBe(0);
    });
  });

  describe('calculateNews2 - risk level derivation', () => {
    it('should return low_medium for total 1-4 with no single-3 score', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 10,
        spo2: 94,
        temperature: 38.5,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeGreaterThanOrEqual(1);
      expect(result.totalScore).toBeLessThan(5);
      expect(result.riskLevel).toBe('low_medium');
    });

    it('should return medium when any single component scores 3', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 7,
        spo2: 97,
        temperature: 37.0,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.riskLevel).toBe('medium');
      expect(result.alertTriggered).toBe(true);
    });

    it('should return medium for total 5-6', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 22,
        spo2: 93,
        temperature: 38.5,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeGreaterThanOrEqual(5);
      expect(result.riskLevel).toBe('medium');
      expect(result.alertTriggered).toBe(true);
    });

    it('should return high for total >= 7', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 25,
        spo2: 91,
        temperature: 39.5,
        systolicBp: 85,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeGreaterThanOrEqual(7);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('calculateNews2 - alert triggering', () => {
    it('should trigger alert when total score >= 5', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 22,
        spo2: 93,
        temperature: 38.5,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      if (result.totalScore >= 5) {
        expect(result.alertTriggered).toBe(true);
      }
    });

    it('should trigger alert when any single component is 3', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 7,
        spo2: 98,
        temperature: 37.0,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.alertTriggered).toBe(true);
    });

    it('should not trigger alert for total < 5 with no component = 3', () => {
      const input: News2Input = {
        patientId: 'p',
        respiratoryRate: 10,
        spo2: 94,
        temperature: 37.0,
        systolicBp: 120,
        heartRate: 75,
        consciousness: 'alert',
      };

      const result = service.calculateNews2(input);

      expect(result.totalScore).toBeLessThan(5);
      expect(result.alertTriggered).toBe(false);
    });
  });

  describe('recordNews2Score - baseline-aware escalation workflow', () => {
    it('records baseline comparisons and creates a linked escalation task', async () => {
      const nurseTaskService = {
        createTask: jest.fn().mockResolvedValue({ id: 'nurse-task-1' }),
        updateTask: jest.fn(),
      };
      const workflowService = new EarlyWarningService(null as any, null as any, nurseTaskService as any);

      let scoreRow: any = null;
      const baselineRepo = {
        find: jest.fn().mockResolvedValue([
          {
            patientId: 'pat-1',
            metricName: 'heartRate',
            baselineValue: 72,
            lowerBound: 62,
            upperBound: 82,
            sampleCount: 6,
          },
        ]),
      };
      const scoreRepo = {
        create: jest.fn().mockImplementation((payload) => payload),
        save: jest.fn().mockImplementation(async (payload) => {
          scoreRow = { id: 'ews-1', ...payload };
          return scoreRow;
        }),
        findOne: jest.fn(),
      };
      const escalationRows: any[] = [];
      const escalationRepo = {
        create: jest.fn().mockImplementation((payload) => payload),
        save: jest.fn().mockImplementation(async (payload) => {
          if (!payload.id) {
            const row = { id: `esc-${escalationRows.length + 1}`, ...payload };
            escalationRows.push(row);
            return row;
          }
          const index = escalationRows.findIndex((row) => row.id === payload.id);
          if (index >= 0) escalationRows[index] = { ...escalationRows[index], ...payload };
          return payload;
        }),
        find: jest.fn().mockResolvedValue([]),
      };
      const tenantDb = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity.name === 'PatientVitalBaseline') return baselineRepo;
          if (entity.name === 'PatientEarlyWarningScore') return scoreRepo;
          if (entity.name === 'ClinicalEscalationTask') return escalationRepo;
          return null;
        }),
      };

      const result = await workflowService.recordNews2Score(tenantDb as any, {
        patientId: 'pat-1',
        heartRate: 128,
        respiratoryRate: 24,
        spo2: 93,
        temperature: 38.4,
        systolicBp: 102,
        consciousness: 'alert',
      }, 'test-tenant');

      expect(result.alertTriggered).toBe(true);
      expect(result.escalationTaskId).toBe('esc-1');
      expect(result.componentScores.baselineComparisons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metric: 'heartRate',
            baselineValue: 72,
            currentValue: 128,
            outsideExpectedRange: true,
          }),
        ]),
      );
      expect(result.explanationSummary).toContain('heartRate');
      expect(nurseTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'pat-1',
          taskType: 'deterioration_review',
          sourceType: 'clinical_escalation',
          sourceId: 'esc-1',
        }),
        tenantDb,
      );
    });

    it('acknowledges linked escalation tasks and moves nurse task to in_progress', async () => {
      const nurseTaskService = {
        createTask: jest.fn(),
        updateTask: jest.fn().mockResolvedValue({}),
      };
      const workflowService = new EarlyWarningService(null as any, null as any, nurseTaskService as any);

      const savedScore = {
        id: 'ews-ack-1',
        patientId: 'pat-1',
        alertAcknowledgedAt: null,
        alertAcknowledgedBy: null,
      };
      const scoreRepo = {
        findOne: jest.fn().mockResolvedValue(savedScore),
        save: jest.fn().mockImplementation(async (payload) => payload),
      };
      const escalationRows = [
        {
          id: 'esc-1',
          earlyWarningScoreId: 'ews-ack-1',
          nurseTaskId: 'nurse-task-1',
          status: 'open',
          acknowledgedAt: null,
          acknowledgedBy: null,
        },
      ];
      const escalationRepo = {
        find: jest.fn().mockResolvedValue(escalationRows),
        save: jest.fn().mockImplementation(async (payload) => payload),
      };
      const tenantDb = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity.name === 'PatientEarlyWarningScore') return scoreRepo;
          if (entity.name === 'ClinicalEscalationTask') return escalationRepo;
          return null;
        }),
      };

      const result = await workflowService.acknowledgeAlert(tenantDb as any, 'ews-ack-1', 'user-1');

      expect(result.alertAcknowledgedBy).toBe('user-1');
      expect(escalationRows[0].status).toBe('acknowledged');
      expect(nurseTaskService.updateTask).toHaveBeenCalledWith('nurse-task-1', { status: 'in_progress' }, tenantDb);
    });
  });
});
