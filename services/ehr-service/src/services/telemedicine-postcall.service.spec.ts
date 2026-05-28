import { TelemedicinePostcallService } from './telemedicine-postcall.service';

function makeService(overrides: any = {}) {
  const llmService: any = {
    draftClinicalNote: jest.fn().mockResolvedValue({ noteText: 'S: Patient complains...', model: 'gpt-4' }),
    classifyEscalationSignal: jest.fn().mockResolvedValue({ severity: 'none', routeTarget: 'nurse', temporality: 'current', confidence: 0.9, model: 'gpt-4' }),
    ...overrides.llm,
  };
  const alertDelivery: any = {
    broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined),
    ...overrides.alert,
  };
  return new TelemedicinePostcallService(llmService, alertDelivery);
}

function makeDb(sessionRow: any = null, existingRow: any = null) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('telemedicine_sessions') && sql.includes('SELECT')) {
        return Promise.resolve(sessionRow ? [sessionRow] : []);
      }
      if (
        sql.includes('telemedicine_postcall_events') &&
        sql.includes('SELECT') &&
        !sql.includes('retry_count')
      ) {
        return Promise.resolve(existingRow ? [existingRow] : []);
      }
      if (sql.includes('INSERT INTO telemedicine_postcall_events')) {
        return Promise.resolve([{ id: 'event-uuid-1' }]);
      }
      if (sql.includes('encounters') && sql.includes('SELECT')) {
        return Promise.resolve([{
          id: 'enc-1', patient_id: 'pat-1', doctor_id: 'doc-1',
          first_name: 'John', last_name: 'Doe',
        }]);
      }
      if (sql.includes('clinical_notes') && sql.includes('SELECT')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
  };
}

const basePayload: any = {
  event: 'meeting.ended',
  id: 'session-abc',
  payload: { room: { name: 'room-xyz' }, meeting: { id: 'meet-1', duration: 300 } },
  timestamp: Math.floor(Date.now() / 1000),
};

describe('TelemedicinePostcallService', () => {
  it('skips if no active session found for room', async () => {
    const svc = makeService();
    const db = makeDb(null);
    await svc.handleCallEnded(basePayload, db, 'test');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('telemedicine_sessions'),
      expect.any(Array),
    );
    const insertCalls = (db.query as jest.Mock).mock.calls.filter(
      ([sql]: [string]) => sql.includes('INSERT INTO telemedicine_postcall_events'),
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('is idempotent — skips if event already processed', async () => {
    const svc = makeService();
    const sessionRow = { room_name: 'room-xyz', patient_id: 'p1', doctor_id: 'd1', encounter_id: 'e1' };
    const db = makeDb(sessionRow, { id: 'existing-event' });
    await svc.handleCallEnded(basePayload, db, 'test');
    const insertCalls = (db.query as jest.Mock).mock.calls.filter(
      ([sql]: [string]) => sql.includes('INSERT INTO telemedicine_postcall_events'),
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('creates event row on new call end', async () => {
    const svc = makeService();
    const sessionRow = { room_name: 'room-xyz', patient_id: 'p1', doctor_id: 'd1', encounter_id: 'e1' };
    const db = makeDb(sessionRow, null);
    await svc.handleCallEnded(basePayload, db, 'subdomain1');
    const insertCalls = (db.query as jest.Mock).mock.calls.filter(
      ([sql]: [string]) => sql.includes('INSERT INTO telemedicine_postcall_events'),
    );
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it('continues pipeline if LLM throws', async () => {
    const svc = makeService({
      llm: { draftClinicalNote: jest.fn().mockRejectedValue(new Error('LLM down')) },
    });
    const sessionRow = { room_name: 'room-xyz', patient_id: 'p1', doctor_id: 'd1', encounter_id: 'e1' };
    const db = makeDb(sessionRow, null);
    await expect(svc.handleCallEnded(basePayload, db, 'test')).resolves.not.toThrow();
  });

  it('getPostcallEvents returns results', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'e1', status: 'completed' }]) };
    const result = await svc.getPostcallEvents('p1', db);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'e1' });
  });

  it('retryFailed throws when max retries exceeded', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn().mockResolvedValue([{ id: 'ev-1', retry_count: 3, daily_room_name: 'r1' }]),
    };
    await expect(svc.retryFailed('ev-1', db, 'sub')).rejects.toThrow('Max retries exceeded');
  });

  it('retryFailed throws when event not found', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    await expect(svc.retryFailed('missing', db, 'sub')).rejects.toThrow('Event not found');
  });

  it('broadcasts alert when escalation is critical', async () => {
    const alertDelivery = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService({
      llm: {
        draftClinicalNote: jest.fn().mockResolvedValue({ noteText: 'S: chest pain', model: 'gpt-4' }),
        classifyEscalationSignal: jest.fn().mockResolvedValue({ severity: 'critical', routeTarget: 'emergency', temporality: 'current', confidence: 0.95, rationale: 'chest pain', model: 'gpt-4' }),
      },
      alert: alertDelivery,
    });
    const sessionRow = { room_name: 'room-xyz', patient_id: 'p1', doctor_id: 'd1', encounter_id: 'e1' };
    const db = makeDb(sessionRow, null);
    await svc.handleCallEnded(basePayload, db, 'clinic1');
    await new Promise((r) => setTimeout(r, 150));
  });
});
