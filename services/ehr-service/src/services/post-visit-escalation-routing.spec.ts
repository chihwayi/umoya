import { PostVisitEscalationRoutingService } from './post-visit-escalation-routing.service';

describe('PostVisitEscalationRoutingService', () => {
  let service: PostVisitEscalationRoutingService;
  let alertDelivery: any;
  let db: any;

  beforeEach(() => {
    alertDelivery = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    db = {
      query: jest.fn().mockResolvedValue([{ id: 'uuid-1' }]),
      options: { database: 'clinic_test_db' },
    };
    service = new PostVisitEscalationRoutingService(
      alertDelivery,
      { getAllActiveTenants: jest.fn().mockResolvedValue([{ databaseName: 'clinic_test_db', subdomain: 'tc' }]) } as any,
    );
  });

  it('creates nurse task and escalation record for high level', async () => {
    const id = await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'high',
      summary: 'Elevated troponin detected',
      findings: ['Troponin 0.8 ng/mL (high)'],
    }, db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_tasks'),
      expect.any(Array),
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO post_visit_escalations'),
      expect.any(Array),
    );
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalled();
    expect(id).toBeDefined();
  });

  it('returns null and does not create task for low level', async () => {
    const id = await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'low',
      summary: 'Routine',
      findings: [],
    }, db);
    expect(id).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not broadcast for moderate level', async () => {
    await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'moderate',
      summary: 'Borderline finding',
      findings: ['borderline glucose'],
    }, db);
    expect(alertDelivery.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('acknowledges escalation and updates nurse task', async () => {
    await service.acknowledgeEscalation('esc-1', 'user-1', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'acknowledged'"),
      expect.arrayContaining(['esc-1', 'user-1']),
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'in_progress'"),
      expect.any(Array),
    );
  });

  it('resolves escalation and marks nurse task completed', async () => {
    await service.resolveEscalation('esc-1', 'user-1', 'Patient stable', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'resolved'"),
      expect.arrayContaining(['esc-1', 'user-1', 'Patient stable']),
    );
  });
});
