import { StaffDutyRosteringService } from './staff-duty-rostering.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('StaffDutyRosteringService', () => {
  let service: StaffDutyRosteringService;
  let db: any;

  beforeEach(() => {
    service = new StaffDutyRosteringService();
    db = { query: jest.fn() };
  });

  it('creates a shift when no overlap exists', async () => {
    db.query.mockResolvedValueOnce([]);
    db.query.mockResolvedValueOnce([{ id: 'shift-1' }]);
    const result = await service.createShift(db, 'tenant-1', 'creator-1', {
      userId: 'user-1', ward: 'ICU', shiftDate: '2026-09-01', startTime: '08:00', endTime: '16:00',
    });
    expect(result).toEqual({ id: 'shift-1' });
  });

  it('rejects creating a shift that overlaps an existing scheduled shift for the same staff member', async () => {
    db.query.mockResolvedValueOnce([{ id: 'existing-shift', ward: 'Maternity', start_time: '07:00', end_time: '15:00' }]);
    await expect(
      service.createShift(db, 'tenant-1', 'creator-1', {
        userId: 'user-1', ward: 'ICU', shiftDate: '2026-09-01', startTime: '08:00', endTime: '16:00',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException updating status of a nonexistent shift', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(service.updateShiftStatus(db, 'tenant-1', 'missing', 'completed')).rejects.toThrow(NotFoundException);
  });

  it('rescheduleShift throws NotFoundException when the shift does not exist', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(
      service.rescheduleShift(db, 'tenant-1', 'missing', { shiftDate: '2026-09-02' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rescheduleShift rejects a move that creates a new overlap', async () => {
    db.query.mockResolvedValueOnce([{ id: 'shift-1', user_id: 'user-1', ward: 'ICU', shift_date: '2026-09-01', start_time: '08:00', end_time: '16:00' }]);
    db.query.mockResolvedValueOnce([{ id: 'other-shift', ward: 'ER', start_time: '15:00', end_time: '23:00' }]);
    await expect(
      service.rescheduleShift(db, 'tenant-1', 'shift-1', { startTime: '14:00', endTime: '22:00' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rescheduleShift succeeds and excludes the shift itself from the overlap check', async () => {
    db.query.mockResolvedValueOnce([{ id: 'shift-1', user_id: 'user-1', ward: 'ICU', shift_date: '2026-09-01', start_time: '08:00', end_time: '16:00' }]);
    db.query.mockResolvedValueOnce([]);
    db.query.mockResolvedValueOnce([{ id: 'shift-1', ward: 'ICU', start_time: '09:00', end_time: '17:00' }]);
    const result = await service.rescheduleShift(db, 'tenant-1', 'shift-1', { startTime: '09:00', endTime: '17:00' });
    expect(result.start_time).toBe('09:00');
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('id <> $6'), expect.arrayContaining(['shift-1']));
  });

  it('addHandoverNote inserts with from_user_id from the acting user', async () => {
    db.query.mockResolvedValueOnce([{ id: 'note-1' }]);
    await service.addHandoverNote(db, 'tenant-1', 'nurse-1', { ward: 'ICU', notes: 'Patient in bed 4 stable overnight' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO shift_handover_notes'),
      expect.arrayContaining(['tenant-1', null, 'ICU', 'nurse-1', null, 'Patient in bed 4 stable overnight']),
    );
  });
});
