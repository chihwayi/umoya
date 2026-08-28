import { PatientSafetyIncidentService } from './patient-safety-incident.service';
import { NotFoundException } from '@nestjs/common';

describe('PatientSafetyIncidentService', () => {
  let service: PatientSafetyIncidentService;
  let db: any;

  beforeEach(() => {
    service = new PatientSafetyIncidentService();
    db = { query: jest.fn() };
  });

  it('marks requires_rca true for harm levels at/above moderate_harm', async () => {
    db.query.mockResolvedValueOnce([{ id: 'inc-1' }]);
    await service.reportIncident(db, 'tenant-1', 'user-1', {
      incidentType: 'medication_error',
      harmLevel: 'moderate_harm',
      incidentDate: '2026-08-27',
      description: 'Wrong dose administered',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patient_safety_incidents'),
      expect.arrayContaining(['tenant-1', 'medication_error', 'moderate_harm', null, expect.any(String), null, '2026-08-27', 'Wrong dose administered', null, 'user-1', true]),
    );
  });

  it('marks requires_rca false for near_miss', async () => {
    db.query.mockResolvedValueOnce([{ id: 'inc-1' }]);
    await service.reportIncident(db, 'tenant-1', 'user-1', {
      incidentType: 'fall',
      harmLevel: 'near_miss',
      incidentDate: '2026-08-27',
      description: 'Patient nearly fell',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patient_safety_incidents'),
      expect.arrayContaining([false]),
    );
  });

  it('throws NotFoundException when starting RCA on a nonexistent incident', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(service.startRca(db, 'tenant-1', 'missing-id', {})).rejects.toThrow(NotFoundException);
  });

  it('blocks closeIncident while corrective actions remain open', async () => {
    db.query.mockResolvedValueOnce([{ n: 2 }]);
    await expect(service.closeIncident(db, 'tenant-1', 'inc-1')).rejects.toThrow('open corrective actions remain');
  });

  it('allows closeIncident once no corrective actions remain open', async () => {
    db.query.mockResolvedValueOnce([{ n: 0 }]);
    db.query.mockResolvedValueOnce([{ id: 'inc-1', status: 'closed' }]);
    const result = await service.closeIncident(db, 'tenant-1', 'inc-1');
    expect(result.status).toBe('closed');
  });

  it('builds dashboard aggregates from the four grouped queries', async () => {
    db.query
      .mockResolvedValueOnce([{ incident_type: 'fall', n: 3 }])
      .mockResolvedValueOnce([{ location: 'Ward 4', n: 2 }])
      .mockResolvedValueOnce([{ harm_level: 'mild_harm', n: 1 }])
      .mockResolvedValueOnce([{ id: 'action-1', due_date: '2026-08-01' }]);

    const dashboard = await service.getDashboard(db, 'tenant-1', '2026-05-01');
    expect(dashboard.byType).toEqual([{ incidentType: 'fall', count: 3 }]);
    expect(dashboard.byLocation).toEqual([{ location: 'Ward 4', count: 2 }]);
    expect(dashboard.bySeverity).toEqual([{ harmLevel: 'mild_harm', count: 1 }]);
    expect(dashboard.overdueActions).toEqual([{ id: 'action-1', due_date: '2026-08-01' }]);
    expect(dashboard.since).toBe('2026-05-01');
  });
});
