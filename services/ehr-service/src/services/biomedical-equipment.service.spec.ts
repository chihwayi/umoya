import { BiomedicalEquipmentService } from './biomedical-equipment.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BiomedicalEquipmentService', () => {
  let service: BiomedicalEquipmentService;
  let db: any;

  beforeEach(() => {
    service = new BiomedicalEquipmentService();
    db = { query: jest.fn() };
  });

  it('computes next_calibration_due_date from last_calibration_date + interval on registration', async () => {
    db.query.mockResolvedValueOnce([{ id: 'eq-1' }]);
    await service.registerEquipment(db, 'tenant-1', {
      equipmentType: 'ventilator', name: 'Puritan Bennett 840', lastCalibrationDate: '2026-01-01', calibrationIntervalDays: 180,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO biomedical_equipment'),
      expect.arrayContaining(['tenant-1', 'ventilator', 'Puritan Bennett 840', null, null, null, null, null, '2026-01-01', 180, '2026-06-30']),
    );
  });

  it('leaves next_calibration_due_date null when no last_calibration_date is provided', async () => {
    db.query.mockResolvedValueOnce([{ id: 'eq-1' }]);
    await service.registerEquipment(db, 'tenant-1', { equipmentType: 'monitor', name: 'Philips IntelliVue' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO biomedical_equipment'),
      expect.arrayContaining([null]),
    );
  });

  it('throws NotFoundException logging maintenance on nonexistent equipment', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(
      service.logMaintenanceEvent(db, 'tenant-1', 'missing', 'user-1', { eventType: 'calibration' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an invalid event type', async () => {
    db.query.mockResolvedValueOnce([{ id: 'eq-1', calibration_interval_days: 365 }]);
    await expect(
      service.logMaintenanceEvent(db, 'tenant-1', 'eq-1', 'user-1', { eventType: 'bogus' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('a calibration event advances last_calibration_date and next_calibration_due_date', async () => {
    db.query.mockResolvedValueOnce([{ id: 'eq-1', calibration_interval_days: 365 }]);
    db.query.mockResolvedValueOnce([{ id: 'log-1', event_type: 'calibration' }]);
    db.query.mockResolvedValueOnce([]);
    await service.logMaintenanceEvent(db, 'tenant-1', 'eq-1', 'user-1', { eventType: 'calibration' });
    expect(db.query).toHaveBeenNthCalledWith(3,
      expect.stringContaining('last_calibration_date = CURRENT_DATE'),
      expect.arrayContaining(['eq-1', 'tenant-1']),
    );
  });

  it('an out_of_service event flips status and records the reason', async () => {
    db.query.mockResolvedValueOnce([{ id: 'eq-1', calibration_interval_days: 365 }]);
    db.query.mockResolvedValueOnce([{ id: 'log-1' }]);
    db.query.mockResolvedValueOnce([]);
    await service.logMaintenanceEvent(db, 'tenant-1', 'eq-1', 'user-1', { eventType: 'out_of_service', notes: 'Cracked housing' });
    expect(db.query).toHaveBeenNthCalledWith(3,
      expect.stringContaining("status = 'out_of_service'"),
      expect.arrayContaining(['eq-1', 'tenant-1', 'Cracked housing']),
    );
  });

  it('dashboard returns byType/byStatus/overdue/dueSoon from the four queries', async () => {
    db.query
      .mockResolvedValueOnce([{ equipment_type: 'infusion_pump', n: 5 }])
      .mockResolvedValueOnce([{ status: 'in_service', n: 4 }])
      .mockResolvedValueOnce([{ id: 'eq-1' }])
      .mockResolvedValueOnce([{ id: 'eq-2' }]);

    const dashboard = await service.getDashboard(db, 'tenant-1');
    expect(dashboard.byType).toEqual([{ equipmentType: 'infusion_pump', count: 5 }]);
    expect(dashboard.byStatus).toEqual([{ status: 'in_service', count: 4 }]);
    expect(dashboard.overdueCalibration).toEqual([{ id: 'eq-1' }]);
    expect(dashboard.dueWithin30Days).toEqual([{ id: 'eq-2' }]);
  });
});
