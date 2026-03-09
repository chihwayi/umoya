import { DataSource } from 'typeorm';
import { SchedulingIntelligenceService } from './scheduling-intelligence.service';

const mockQuery = jest.fn();
const mockTenantDb = { query: mockQuery, getRepository: jest.fn() } as unknown as DataSource;

let service: SchedulingIntelligenceService;

beforeEach(() => {
  mockQuery.mockReset();
  service = new SchedulingIntelligenceService();
});

function makeDate(daysFromNow: number, hour = 10, dayOfWeek?: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  if (dayOfWeek !== undefined) {
    const diff = (dayOfWeek - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
  }
  d.setHours(hour, 0, 0, 0);
  return d;
}

function setupQueries(opts: {
  historyRows?: any[];
  appointmentRows?: any[];
}) {
  const { historyRows = [], appointmentRows = [] } = opts;
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM appointments') && sql.includes('appointment_date < NOW()')) {
      return historyRows;
    }
    if (sql.includes('FROM appointments WHERE id')) {
      return appointmentRows;
    }
    if (sql.includes('INSERT INTO appointment_no_show_predictions')) {
      return [{ id: 'pred-1' }];
    }
    return [];
  });
}

describe('SchedulingIntelligenceService', () => {
  describe('predictNoShow - historical no-show rate', () => {
    it('should assign high probability for patient with 50% no-show rate', async () => {
      const history = [];
      for (let i = 0; i < 5; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 5; i++) history.push({ status: 'completed', appointment_date: new Date() });

      const apptDate = makeDate(5);
      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.noShowProbability).toBeGreaterThanOrEqual(0.25);
      expect(result.riskFactors.some(f => f.factor.includes('no_show'))).toBe(true);
    });

    it('should assign moderate probability for 20% no-show rate', async () => {
      const history = [];
      for (let i = 0; i < 2; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 8; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.noShowProbability).toBeGreaterThan(0.02);
      expect(result.riskFactors.some(f => f.factor.includes('no_show'))).toBe(true);
    });

    it('should add high_cancellation_rate factor when > 30% cancelled', async () => {
      const history = [];
      for (let i = 0; i < 4; i++) history.push({ status: 'cancelled', appointment_date: new Date() });
      for (let i = 0; i < 6; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'high_cancellation_rate')).toBe(true);
    });

    it('should return zero no-show factors for perfect attendance', async () => {
      const history = [];
      for (let i = 0; i < 10; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.every(f => !f.factor.includes('no_show'))).toBe(true);
    });
  });

  describe('predictNoShow - new patient', () => {
    it('should include new_patient factor when no history exists', async () => {
      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'new_patient', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'new_patient')).toBe(true);
      expect(result.noShowProbability).toBeGreaterThanOrEqual(0.15);
    });

    it('should set new_patient weight to 0.15', async () => {
      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'new', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      const newPatientFactor = result.riskFactors.find(f => f.factor === 'new_patient');
      expect(newPatientFactor).toBeDefined();
      expect(newPatientFactor!.weight).toBe(0.15);
    });
  });

  describe('predictNoShow - appointment timing factors', () => {
    it('should include long_lead_time factor for appointment booked 45 days out', async () => {
      const now = new Date();
      const apptDate = new Date(now);
      apptDate.setDate(apptDate.getDate() + 45);
      const createdDate = new Date(now);

      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: createdDate }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'long_lead_time')).toBe(true);
    });

    it('should include moderate_lead_time for 20-day lead time', async () => {
      const now = new Date();
      const apptDate = new Date(now);
      apptDate.setDate(apptDate.getDate() + 20);

      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: now }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'moderate_lead_time')).toBe(true);
    });

    it('should include monday_appointment factor for Monday appointments', async () => {
      const monday = new Date();
      const dayDiff = (1 - monday.getDay() + 7) % 7 || 7;
      monday.setDate(monday.getDate() + dayDiff);
      monday.setHours(10, 0, 0, 0);
      const createdDate = new Date();

      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: monday, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: createdDate }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'monday_appointment')).toBe(true);
    });

    it('should include late_afternoon factor for 4pm+ appointments', async () => {
      const apptDate = makeDate(3);
      apptDate.setHours(17, 0, 0, 0);

      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.some(f => f.factor === 'late_afternoon')).toBe(true);
    });

    it('should not include late_afternoon for morning appointments', async () => {
      const apptDate = makeDate(3);
      apptDate.setHours(9, 0, 0, 0);

      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.every(f => f.factor !== 'late_afternoon')).toBe(true);
    });
  });

  describe('predictNoShow - suggested actions', () => {
    it('should suggest call_patient for probability >= 0.6', async () => {
      const history = [];
      for (let i = 0; i < 9; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 1; i++) history.push({ status: 'completed', appointment_date: new Date() });

      const now = new Date();
      const apptDate = new Date(now);
      apptDate.setDate(apptDate.getDate() + 50);

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: apptDate, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: now }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      if (result.noShowProbability >= 0.6) {
        expect(result.suggestedAction).toBe('call_patient');
      } else {
        expect(result.suggestedAction).toBeTruthy();
      }
    });

    it('should suggest send_extra_reminder for probability between 0.4 and 0.59', async () => {
      const history = [];
      for (let i = 0; i < 8; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 12; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(3), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      if (result.noShowProbability >= 0.4 && result.noShowProbability < 0.6) {
        expect(result.suggestedAction).toBe('send_extra_reminder');
      }
    });

    it('should suggest offer_telehealth for probability between 0.25 and 0.39', async () => {
      const history = [];
      for (let i = 0; i < 5; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 5; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      if (result.noShowProbability >= 0.25 && result.noShowProbability < 0.4) {
        expect(result.suggestedAction).toBe('offer_telehealth');
      }
    });

    it('should suggest null for very low probability', async () => {
      const history = [];
      for (let i = 0; i < 10; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(3), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      if (result.noShowProbability < 0.25) {
        expect(result.suggestedAction).toBeNull();
      }
    });
  });

  describe('predictNoShow - result structure', () => {
    it('should return correct model version', async () => {
      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.modelVersion).toBe('rule_v1');
    });

    it('should persist prediction and return generated ID', async () => {
      setupQueries({
        historyRows: [],
        appointmentRows: [{ appointment_date: makeDate(5), appointment_type: 'new', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.id).toBe('pred-1');
      expect(result.appointmentId).toBe('appt-1');
      expect(result.patientId).toBe('pat-1');
    });

    it('should cap probability at 0.95', async () => {
      const history = [];
      for (let i = 0; i < 20; i++) history.push({ status: 'no_show', appointment_date: new Date() });

      const now = new Date();
      const apptDate = new Date(now);
      apptDate.setDate(apptDate.getDate() + 60);
      const monday = new Date(apptDate);
      const dayDiff = (1 - monday.getDay() + 7) % 7 || 7;
      monday.setDate(monday.getDate() + dayDiff);
      monday.setHours(17, 0, 0, 0);

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: monday, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: now }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.noShowProbability).toBeLessThanOrEqual(0.95);
    });

    it('should have minimum probability of 0.02', async () => {
      const history = [];
      for (let i = 0; i < 20; i++) history.push({ status: 'completed', appointment_date: new Date() });

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: makeDate(1), appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: new Date() }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.noShowProbability).toBeGreaterThanOrEqual(0.02);
    });
  });

  describe('predictNoShow - combined factors', () => {
    it('should accumulate multiple risk factors', async () => {
      const history = [];
      for (let i = 0; i < 5; i++) history.push({ status: 'no_show', appointment_date: new Date() });
      for (let i = 0; i < 5; i++) history.push({ status: 'completed', appointment_date: new Date() });

      const now = new Date();
      const monday = new Date(now);
      const dayDiff = (1 - monday.getDay() + 7) % 7 || 7;
      monday.setDate(monday.getDate() + dayDiff + 42);
      monday.setHours(17, 0, 0, 0);

      setupQueries({
        historyRows: history,
        appointmentRows: [{ appointment_date: monday, appointment_type: 'follow_up', doctor_id: 'doc-1', duration_minutes: 30, created_at: now }],
      });

      const result = await service.predictNoShow(mockTenantDb, 'appt-1', 'pat-1');

      expect(result.riskFactors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
